import { ViewChild } from '@angular/core';
import { ElementRef } from '@angular/core';
import { Component } from '@angular/core';
import * as AWS from 'aws-sdk';
import { S3 } from 'aws-sdk';

@Component({
  selector: 'app-root',
  templateUrl: "./app.component.html",
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'screen-recorder';
  nav: any;
  recorder;
  recordedChunks: any[]= [];
  bucketName = "k45";
  s3;
  filename="thisisatestfile";
  uploadId: any = null;
  etag: any;
  incr: any;
  booleanStop=false;
  stream;
  normalArr = [];

  constructor() { this.nav = navigator;
    AWS.config.region = 'us-east-2'; // Region
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'us-east-2:e92eec9c-d9d8-46be-a57c-6b585c90b76f',
    });
    this.s3 = new AWS.S3({
      apiVersion: "2006-03-01",
      params: { Bucket: this.bucketName }
    });
    this.etag=[];
  }

  ngOnInit() {
    this.startRecording()
    
  }

  async startRecording() {
    var stream = await this.nav.mediaDevices.getDisplayMedia({ video: true})
    stream.getTracks().forEach(function(track) {
      console.log(track.getSettings());
  })
    this.videoElement.srcObject = stream
    this.recorder = new MediaRecorder(stream);
    // this.recorder.addEventListener('dataavailable', this.onData ).bind(this)
    this.recorder.ondataavailable=this.onData.bind(this)
    // var upload = new AWS.S3.ManagedUpload({
    //   params: {Bucket: this.bucketName, Key: this.filename, Body: this.stream}
    // });
    // var promise = upload.promise();
    // promise.then(console.log)
        console.log(this.videoElement.srcObject)
        this.recorder.start(300)
  }



  @ViewChild('video') videoElementRef: ElementRef
  get videoElement(): HTMLVideoElement {
    return this.videoElementRef.nativeElement
    
  }
  onData(e){
    this.recordedChunks.push(e.data);
    this.normalArr.push(e.data);
    var blob = new Blob(this.normalArr, {
      type: "video/mp4"
      });
      if (blob.size> 5242880 ){
        this.normalArr=[];
    	if (this.uploadId ==null) {
        this.startMultiUpload(blob, this.filename)
        } else {
          this.incr = this.incr + 1
 	this.continueMultiUpload(blob, this.incr, this.uploadId, this.filename, this.bucketName);
        }
 	}

  }
  startMultiUpload(blob, filename) {
    var audioBlob = blob;
    var params = {
        Bucket: this.bucketName,
        Key: filename,
        ContentType: 'audio/webm',
        ACL: 'private',
    };
    this.s3.createMultipartUpload(params, (err, data) =>{
        if (err) {
            console.log(err, err.stack); // an error occurred
        } else {
            this.uploadId = data.UploadId
            this.incr = 1;
            this.continueMultiUpload(audioBlob, this.incr, this.uploadId, this.filename, this.bucketName);
        }
    });
}
continueMultiUpload(audioBlob, PartNumber, uploadId, key, bucketName) {
  var params = {
      Body: audioBlob,
      Bucket: bucketName,
      Key: key,
      PartNumber: PartNumber,
      UploadId: uploadId
  };
  this.s3.uploadPart(params, (err, data) =>{
      if (err) {
          console.log(err, err.stack)
      } // an error occurred
      else {
          /*
              Once the part of data is uploaded we get an Entity tag for the uploaded object(ETag).
              which is used later when we complete our multipart upload.
          */
          console.log(data);
          this.etag.push(data.ETag);
          if (this.booleanStop == true) {
              this.completeMultiUpload();
          }
      }
  });
}
completeMultiUpload() {
  var outputTag = [];
  /*
      here we are constructing the Etag data in the required format.
  */
  this.etag.forEach((data, index) => {
      const obj = {
          ETag: data,
          PartNumber: ++index
      };
      outputTag.push(obj);
  });

  var params = {
      Bucket: this.bucketName, // required 
      Key: this.filename, // required 
      UploadId: this.uploadId, // required 
      MultipartUpload: {
          Parts: outputTag
      }
  };

  this.s3.completeMultipartUpload(params, (err, data)=> {
      if (err) {
          console.log(err, err.stack)
      } // an error occurred
      else {
          // initialize variable back to normal
          this.etag = [], 
          this.recordedChunks = [];
          this.uploadId = "";
          this.booleanStop = false;
          alert("we have successfully saved the video");
      }
  });
}
complete(){
  this.booleanStop=true;
  this.recorder.stop();
  // this.stream.getTracks().forEach(function(track) {
  //   track.stop();
  // });
}
}
