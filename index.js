var http = require('http');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var arDrone = require('ar-drone');
var fs = require('fs');
var uuid = require('uuid');

var yhat = require('yhat');
var yh = yhat.init(YHAT_USERNAME, YHAT_APIKEY, YHAT_URL);

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('hogan-express'));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var automatedFlight = false;
// var drone = arDrone.createClient({ frameRate: 0.5 });
var drone = arDrone.createClient({ frameRate: 5 });
drone.takeoff();

drone
  .after(2000, function() {
    drone.calibrate(0);
    drone.stop();
    // drone.config('video:video_channel', 1);
    console.log("STABLIZING...");

var droneStuff = {};

var moving = false;
var lastPng;
var pngStream = drone.getPngStream();
pngStream
  .on('error', function(err) {
    console.log("[ERROR]: problem with png stream --> " + err);
  })
  .on('data', function(pngBuffer) {

    if (moving==true || automatedFlight==false) {
      return;
    }

    var t = new Date();
    var filename = path.join(__dirname, 'public/img/flight/' + uuid.v4().toString() + '.png');
    fs.writeFile(filename, pngBuffer, function(err) {
      if (err) {
        console.log("[ERROR]: could not save png: " + err);
        return;
      }
      var payload = {
        image64: pngBuffer.toString('base64')
      };
      yh.predict("DroneModel", payload, function(err, data) {

        if (automatedFlight) {
          var x = data.x / data.xmax - 0.5;
          if (Math.abs(x)==0.5) {
            drone.stop(); // i think this is weird enough that we should just stop and do nothing
            return;
          }
          if (Math.abs(x) < 0.1) {
            drone.stop();
            return;
          }
          var xval = Math.abs(x);
          xval = Math.min(xval, 0.5);
          if (moving==false) {
            xval = 0.2;
            if (x < 0) {
              moving = true;
              drone.left(xval);
            } else {
              moving = true;
              drone.right(xval);
            }
            setTimeout(function() {
              drone.stop();
              setTimeout(function() {
                moving = false;
              }, 500);
            }, 500);
          }

          io.emit('coords', data);
          var publicDir = path.join(__dirname, "public");
          io.emit('filename', data.filename.replace(publicDir, ""));
          io.emit('processedFilename', data.processedFilename.replace(publicDir, ""));
          
          // var y = data.y / data.ymax - 0.5;
        } else {
          console.log("NOT IN FLIGHT MODE");
        }
      });
    });
  });
})


app.use('/', function(req, res) {
  res.render('index');
});


var port = parseInt(process.env.PORT, 10) || 3000
app.set("port", port);
var server = http.createServer(app);
server.listen(port);
console.error("Listening on port: " + port);


var io = require('socket.io')(server);

var filename = path.join(__dirname, "flights", uuid.v4().toString() + ".njson");
var navStream = fs.createWriteStream(filename);
drone.on('navdata', function(data) {
  // this produced too much data...
  // io.emit('navdata', data);
  navStream.write(JSON.stringify(data) + '\n');
});

io.on('connection', function(socket) {
  socket.on('ignition', function() {
    automatedFlight = true;
  });

  socket.on('stop-autonomous', function() {
    automatedFlight = false;
    drone.stop();
    drone.land();
    process.exit(0);
  });
});

