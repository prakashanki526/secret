//jshint esversion:6
require("dotenv").config();
const ejs = require("ejs");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportlocalmongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { profileEnd } = require("console");

const app = express();

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended:true}));

app.use(session({
    secret :"our secret.",
    resave : false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser:true});

// const secretSchema = new mongoose.Schema({
//     secret: String
// });

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    display_name: String,
    secret: [String]
});

userSchema.plugin(passportlocalmongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({ googleId: profile.id, display_name:profile.displayName}, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate("google",{scope: ["profile"]})
);

app.get("/login",function(req,res){
    res.render("login");
});

app.get("/register",function(req,res){
    res.render("register");
});

app.get("/secrets",function(req,res){
    if(req.isAuthenticated()){
        User.find({"secret": {$ne: null}}, function(err,foundusers){
            if(err)
                console.log(err);
            else{
                res.render("secrets", {userswithsecrets:foundusers});
            }
        });
    }
    else{
        res.redirect("/login");
    }
});

app.get("/submit", function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }
    else{
        res.redirect("/login");
    }
});

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/logout", function(req,res,next){
    req.logout(function(err){
        if(err){
            return next(err);
        }
        res.redirect("/");
    });
});

app.get("/my-secrets",function(req,res){
    if(req.isAuthenticated()){
        User.findById(req.user.id, function(err,founduser){
            if(err)
                console.log(err);
            else{
                res.render("my-secrets",{USER: founduser});
            }
        });
    }
    else{
        res.redirect("/login");
    }
});

app.post("/register", function(req,res){
    User.register({username: req.body.username},req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/login", function(req,res){
    const user = new User({
        username: req.body.username,
        password : req.body.password
    });
    
    req.login(user,function(err){
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/submit", function(req,res){
    const submitsecret = req.body.secret;
    User.findById(req.user.id, function(err,founduser){
        if(err)
            console.log(err);
        else{
            founduser.secret.push(submitsecret);
            founduser.save(function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/deletesecret",function(req,res){
    const selectedSecret = req.body.secretname;
    const CurrentUser = req.user.id;

    User.findByIdAndUpdate(
        CurrentUser, { $pull: { secret: { $in: [selectedSecret] }}}, { safe: true, upsert: true },
        function(err, node) {
            if (err) { console.log(err); }
            res.redirect("/my-secrets");
        });
});

app.listen(3000,function(req,res){
    console.log("Started");
});