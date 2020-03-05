const express = require("express"),
      app = express(),
      router = express.Router(),
      FileType = require('file-type'),
      JP = require("jimp"),
      fs = require('fs'),
      AWS = require("aws-sdk"),
      dotenv = require('dotenv');

dotenv.config();
router.post('', (req, res) => { console.log("file name is empty"); res.end("filename is empty") });
router.post('/:filename', handleRequest);

function handleRequest(req, res) {
    console.log(req.originalUrl);
    let fileName = req.params.filename;
    console.log(fileName);
    let contentType = req.headers["content-type"];
    res.setHeader('Content-Type', 'text/plain');
    let bodySize = 0;
    let chunk = "";
    let file = fs.createWriteStream(fileName);
    req
        .on('data', (chunk) => {
            file.write(chunk);
            bodySize += chunk.byteLength;
            if (bodySize > process.env.MAX_FILE_SIZE) { res.end("File size exceeded 1"); res.destroy(); fs.unlinkSync(fileName) }
        })
        .on('end', () => {
            file.on('error', function(err) { /* error handling */ });
            file.write(chunk);
            bodySize += chunk.byteLength;
            if (bodySize > process.env.MAX_FILE_SIZE) { res.end("File size exceeded 2"); res.destroy(); fs.unlinkSync(fileName) }
            file.end();
            handleFile(fileName, res);
        });

}

app
    .use(router)
    .listen(port = process.env.PORT || 80);

console.log("Server is listening");

const handleFile = (fileName, res) => {
    (async () => {
        let fileType = await FileType.fromFile(fileName);
        if (fileType && fileType.mime && fileType.ext) {
            if (process.env.VALID_EXTENSIONS.indexOf(fileType.ext) === -1) { console.log("Invalid file extension"); res.end("Invalid file extension"); }
            if (fileType.mime.startsWith("image")) {
                console.log("this is a image");
                console.log(fileType.ext);
                
                //return /[^.]+$/.exec(filename);
                //return (/[.]/.exec(filename)) ? /[^.]+$/.exec(filename) : undefined;
                let newFileName = fileName;
                let fileNameAsArray = fileName.split('.');
                if (fileNameAsArray.length > 1) {
                    const fileExtension = fileNameAsArray.pop();
                    if (fileType.ext !== fileExtension) {
                        newFileName = fileNameAsArray.join('') + '.' + fileType.ext;
                    }
                    console.log(fileExtension);
                } else {
                    newFileName = fileName + '.' + fileType.ext;
                }

                const image = await JP.read(fileName);
                await image.quality(100);
                let imageHeight = image.getHeight();
                let imageWidth = image.getWidth();
                if (imageHeight >= 2048 && imageWidth >= 2048) {
                    image
                        .resize(2048, 2048)
                        .write("large_" + newFileName)
                        .resize(1024, 1024)
                        .write("medium_" + newFileName);
                } else if (imageHeight >= 1024 && imageWidth >= 1024) {
                    image
                        .resize(1024, 1024)
                        .write("medium_" + newFileName);
                }
                    image
                        .resize(300, 300)
                        .write("small_" + newFileName);
                uploadToAwsS3("small_" + newFileName);
                fs.unlinkSync(fileName);
                res.end("file was transformed");
            }
        } else { console.log("this file is not image"); res.end("this file is not image"); }
        //=> {ext: 'png', mime: 'image/png'}
    })();
};


const uploadToAwsS3 = (fileName) => {
    // Set the region
    //AWS.config.update({region: 'us-west-2'});

// Create S3 service object
    let s3 = new AWS.S3({apiVersion: '2006-03-01', region: 'us-west-1'});


    /* The following example creates a bucket. */

    let params = {
        Bucket: "dmitriy7smirnov1"
    };
    // s3.createBucket(params, function(err, data) {
    //     if (err) console.log(err, err.stack); // an error occurred
    //     else     console.log(data);           // successful response
    //     /*
    //     data = {
    //      Location: "/examplebucket"
    //     }
    //     */
    // });

    let myBucket = 'dmitriy7smirnov1'
    let myKey = 'myTest';

// call S3 to retrieve upload file to specified bucket
    let uploadParams = {Bucket: myBucket, Key: myKey, Body: ''};
    let file = fileName;

// Configure the file stream and obtain the upload parameters
    let fs = require('fs');
    let fileStream = fs.createReadStream(file);
    fileStream.on('error', function(err) {
        console.log('File Error', err);
    });
    uploadParams.Body = fileStream;
    let path = require('path');
    uploadParams.Key = path.basename(file);

// call S3 to retrieve upload file to specified bucket
    s3.upload (uploadParams, function (err, data) {
        if (err) {
            console.log("Error", err);
        } if (data) {
            console.log("Upload Success", data.Location);
        }
    });
};
