const express = require('express')
const app = express()  
const axios = require('axios');
const cookieSession = require('cookie-session')  
const bodyParser = require('body-parser')
const passport = require('passport')

// Datenbank
const mongoose = require('mongoose');
const configDB = require('./config/database.js');
mongoose.connect(configDB.url);
mongoose.connection.once('open', function(){
   console.log('mongoose connected ....');
}).on('error', function(error){
    console.log('connection error:', error);
});


// getting the local authentication type
const LocalStrategy = require('passport-local').Strategy

// import models
const User = require('./models/user');
const Radio = require('./models/radio');

// Middleware
app.use(bodyParser.json())

app.use(cookieSession({  
    name: 'mysession',
    keys: ['vueauthrandomkey'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))

app.use(passport.initialize());

app.use(passport.session());

// home route
app.get("/", (req, res, next) => {
  res.send('hallo')
})

// user authentifizierung/login/logout
app.post("/api/register", (req, res) => {
    let user = new User({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        language: 'Default/English',
        mode: 'alternativeChannel',
        channel: {radioname: 'unselected',
            radiourl: 'unselected',
            nowplayingurl: 'unselected'
        },
        alternativechannel: {radioname: 'unselected',
            radiourl: 'unselected',
            nowplayingurl: 'unselected'
        }
    });
    if (req.body.password == 'danke') {
        user.save();
        res.status(201).send(user);
        console.log(user);
    } else {
        console.log('registration denied')
    }
    
});

app.post('/api/login', passport.authenticate('local-login', {
    successRedirect: '/api/user',
    failureRedirect: '/api/login',
    failureFlash: true
}));

app.get("/api/logout", function(req, res) {  
    req.logout();
    console.log("logged out")
    return res.send();
});

const authMiddleware = (req, res, next) => {  
  if (!req.isAuthenticated()) {
    res.status(401).send('You are not authenticated')
  } else {
    return next()
  }
}

app.get("/api/user", authMiddleware, (req, res) => {
    let userid = req.session.passport.user
    User.findOne({ _id: userid }, function (err, user) {
        res.send({ user: user })
    });
});

passport.use('local-login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
},
function(req, username, password, done){
    process.nextTick(function(){
        User.findOne({ 'username': username}, function(err, user){
            if(err)
                return done(err);
            if(!user)
                return done(null, false);
            if(!user.validPassword(password)){
                return done(null, false);
            }
            return done(null, user);
        })
    })
}                                             
))

passport.serializeUser(function(user, done){
    done(null, user.id);
});
//macht den user wieder komplett
passport.deserializeUser(function(id, done){
    User.findById(id, function(err, user){
        done(err, user);
    });
});

//user settings post routes
app.post('/api/emailchange', (req, res) => {
    let newemail = req.body.newEmail
    let emailchangeid = req.session.passport.user
    User.findOne({ _id: emailchangeid }, function (err, user) {
        user.email = newemail
        user.save();
    })
});

app.post('/api/languageselection', (req, res) => {
    let newlanguage = req.body.selectedLanguage
    let languageselectionid = req.session.passport.user
    User.findOne({ _id: languageselectionid }, function (err, user) {
        user.language = newlanguage
        user.save();
    })
});

app.post('/api/modeselection', (req, res) => {
    let newmode = req.body.selectedMode
    let modeselectionid = req.session.passport.user
    User.findOne({ _id: modeselectionid }, function (err, user) {
        user.mode = newmode
        user.save();
    })
});

app.post('/api/channelselection', (req, res) => {
    let newchannel = req.body.selectedChannel
    let channelselectionid = req.session.passport.user
    User.findOne({ _id: channelselectionid }, function (err, user) {
        Radio.findOne({ radioname: newchannel}, function (err, channel) {
            user.channel.radioname = channel.radioname;
            user.channel.radiourl = channel.radiourl;
            user.channel.nowplayingurl = channel.nowplayingurl
            user.save();
        });
    })
});

app.post('/api/alternativechannelselection', (req, res) => {
    let newalternativechannel = req.body.selectedAlternativeChannel
    let alternativechannelselectionid = req.session.passport.user
    User.findOne({ _id: alternativechannelselectionid }, function (err, user) {
        Radio.findOne({ radioname: newalternativechannel}, function (err, channel) {
            user.alternativechannel.radioname = channel.radioname;
            user.alternativechannel.radiourl = channel.radiourl;
            user.alternativechannel.nowplayingurl = channel.nowplayingurl
            user.save();
        });
    })
});

//shmoo settings post routes (shmooen, entshmooen)
app.post('/api/addshmoo', (req, res) => {
    let addshmooid = req.session.passport.user
    User.findOne({ _id: addshmooid }, function (err, user) {
        user.shmoo.push(req.body.currentSong);
        user.save();
    })
    res.send('ok')
});

app.post('/api/removeshmoo', (req, res) => {
    let removeshmooid = req.session.passport.user
    User.findOne({ _id: removeshmooid }, function (err, user) {
        var toBeRemovedFromShmoo = req.body.elementToBeRemovedFromShmoo
        var indexOftoBeRemovedFromShmoo = user.shmoo.indexOf(toBeRemovedFromShmoo);
        if (indexOftoBeRemovedFromShmoo > -1) {
          user.shmoo.splice(indexOftoBeRemovedFromShmoo, 1);
        }
        user.save();
    })
});

//playlist settings post routes (löschen, hinzufügen)
const fs = require('fs');
app.post('/api/deleteprivateplaylistitem', (req, res) => {
    let deleteprivateplaylistitemid = req.session.passport.user
    User.findOne({ _id: deleteprivateplaylistitemid }, function (err, user) {
        var deleteprivateplaylistitem = req.body.privatePlaylistItem
        var index = user.privateplaylist.indexOf(deleteprivateplaylistitem);
        if (index > -1) {
          user.privateplaylist.splice(index, 1);
        }
        var i;
        var filefs;
        for (i = 0; i < user.privateplaylistfullname.length; i++) {
          var itemfullname = user.privateplaylistfullname[i]
          var itemcheck = itemfullname.slice(33)
          if (itemcheck === deleteprivateplaylistitem) {
              var filefs = itemfullname.slice(0, 32);
              var itemcheck2 = itemfullname.slice(0, 32)
              var index2 = user.privatefilenames.indexOf(itemcheck2);
              if (index2 > -1) {
                user.privatefilenames.splice(index2, 1);
              }
              var index3 = user.privateplaylistfullname.indexOf(itemfullname);
              if (index3 > -1) {
                user.privateplaylistfullname.splice(index3, 1);
              }
          }
          console.log(itemcheck)
        } 
        user.save();
        const path = '../client/static/uploads/' + filefs
        try {
          fs.unlinkSync(path)
          console.log('file removed!!!!!!')
        } catch(err) {
          console.error(err)
        }
        res.send('file removed!!')
    })
});


//multer for fileupload
const multer = require('multer')

const fileFilter = function(req, file, cb) {
    const allowedTypes = ["audio/mpeg", "audio/mp3"];
    if (!allowedTypes.includes(file.mimetype)) {
        const error = new Error('wrong file type');
        error.code = 'LIMIT_FILE_TYPES';
        return cb(error, false);
    }
    cb(null, true);
}

const MAX_SIZE = 20000000;
const upload = multer({
    //dest: '../client/static/uploads/',
    dest: '/var/www/html/',
    fileFilter,
    limits: {
        fileSize: MAX_SIZE
    }
})

app.post('/api/fileupload', upload.single('file'), (req, res) => {
    let fileuploadid = req.session.passport.user
    User.findOne({ _id: fileuploadid }, function (err, user) {
        var newfile = req.file.originalname;
        var newfilename = req.file.filename;
        var fullname = req.file.filename + '_' + req.file.originalname;
        user.privateplaylist.push(newfile);
        user.privatefilenames.push(newfilename);
        user.privateplaylistfullname.push(fullname);
        user.save();
    })
    res.json({ file: req.file });
});

app.use(function(err, req, res, next) {
    if(err.code === 'LIMIT_FILE_TYPES') {
    res.status(422).json({ error: 'only mp3 allowed'});
    return;
    }
    if(err.code === 'LIMIT_FILE_SIZE') {
    res.status(422).json({ error: 'file is too big. Max size: 20MB.'});
    return;
    }
})

// get routes
app.get("/api/getcomments", (req, res) => {
    let getcommentsid = req.session.passport.user
    User.findOne({ _id: getcommentsid }, function (err, user) {
        var findchannel = user.channel.radioname
        if (findchannel == 'unselected') {
          res.send({ comments: [] })
        } else {
          Radio.findOne({ radioname: findchannel}, function (err, radio) {
            res.send({ comments: radio.comments })
        });
        }
    })
});

app.get("/api/radiodata", (req,res) => {
    Radio.find(function (err, radiodata) {
        res.send({ radiodata: radiodata})
    })
});

app.get("/api/securecontent", (req, res) => {
    Radio.findOne({ radioname: '88.6'}, function (err, radio) {
        res.send({ secureContent: radio.securecontent })
    });
});


// >var server = < ist neu weil man die variable für socket braucht
//handle production
    //Static folder
    app.use(express.static(__dirname + '/dist/'));
    
    //Handle SPA
    app.get(/.*/, (req, res) => res.sendFile(__dirname + '/dist/index.html'));


var server = app.listen(3000, '46.101.174.202');   
  console.log("App listening on port 3000 on 46.101.174.202");


// socket - ab hier alles neu
var socket = require('socket.io');

var io = socket(server, {
  cors: {
    origin: "http://127.0.0.1:8080",
    methods: ["GET", "POST"]
  }
});

io.on("connection", socket => {
  console.log('socket connected')
  socket.on('join room', (roomName) => {
    socket.join(roomName);
    console.log('inside join room backend')
    socket.roomname = roomName
    console.log(roomName)
  });
  
  socket.on('send message', (chatmessage) => {
    console.log('inside send message backend')
    console.log(chatmessage)
    console.log(socket.roomname)
    io.to(socket.roomname).emit('new message', chatmessage);
    Radio.findOne({ radioname: socket.roomname}, function (err, radio) {
      console.log(radio.comments.length)
      //console.log(radio.comments)
      radio.comments.push(chatmessage);
      console.log(radio.comments.length)
      //console.log(radio.comments)
      if (radio.comments.length > 15) {
        radio.comments.shift();
        console.log(radio.comments.length)
        //console.log(radio.comments)
        //radio.comments.shift();
        //radio.save();
      }
      console.log(radio.comments.length)
      //console.log(radio.comments)
      radio.save();
    });
  });
});
