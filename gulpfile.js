/*jslint node : true, nomen: true, plusplus: true, vars: true, eqeq: true,*/
"use strict";

var gulp = require('gulp'),
    annotate = require('gulp-ng-annotate'),
    bower = require('gulp-bower'),
    clean = require('gulp-clean'),
    jslint = require('gulp-jslint'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    sourcemaps = require('gulp-sourcemaps');

var dirs = [
    'src/**/*.js'
];

var dist = 'dist';

// jshint Task
gulp.task('jslint', function () {
    return gulp.src(dirs)
        .pipe(jslint({
            node : true,
            unparam: true, //unused params
            nomen: true,
            plusplus: true,
            vars: true,
            eqeq: true,
            white: true,
            todo: true
        }));
});

// bower Task
gulp.task('bower', function () {
    return bower();
});

//concatenation et minification des js
gulp.task('dist', ['bower'], function () {
    return gulp.src(dirs)
        .pipe(sourcemaps.init())
        .pipe(concat('angular-sockjs.js'))
        .pipe(annotate())
        .pipe(gulp.dest(dist))
        .pipe(rename('angular-sockjs.min.js'))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(dist))
        .on('error', function (err) {
            console.log('error creating dist files ' + err);
        });
});

// Tache de nettoyage
gulp.task('clean', function () {
    return gulp.src([dist + '*'], {
        read: false
    }).pipe(clean());
});
