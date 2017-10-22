'use strict';

var gulp       = require('gulp');
var sass       = require('gulp-ruby-sass');
var autoprefix = require('gulp-autoprefixer');
var notify     = require("gulp-notify");
var bower      = require('gulp-bower');

var config = {
	sassPath: './resources/sass',
	bowerDir: './bower_components'
}

gulp.task('bower', function() {
	return bower()
	.pipe(gulp.dest(config.bowerDir))
});


gulp.task('css', function() {
	return gulp.src(config.sassPath + '/styles.scss')
	.pipe(sass({
		style: 'compressed',
		loadPath: [
		'./resources/sass',
		config.bowerDir + '/bootstrap-sass-official/assets/stylesheets',
		]
	})
	.on("error", notify.onError(function (error) {
		return "Error: " + error.message;
	})))
	.pipe(autoprefix({
	            browsers: ['last 3 versions'],
	            remove: false
	        }))
	.pipe(gulp.dest('./public/css'));
});


// Rerun the task when a file changes

//gulp.task('watch', function() {
//	gulp.watch(config.sassPath + '/**/*.scss', ['css']);
//});

gulp.task('default', ['bower', 'css']);
