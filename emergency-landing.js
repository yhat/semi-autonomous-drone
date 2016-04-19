var arDrone = require('ar-drone');
var colors = require('colors');

console.log("EMERGENCY LANDING!!!".red.bold.underline.bgBlack)
var client  = arDrone.createClient();
client.stop();
client.land();
