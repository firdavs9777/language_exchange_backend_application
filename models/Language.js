const mongoose = require('mongoose');
const slugify = require('slugify');

const LanguageSchema = new mongoose.Schema({
	code:{
		type: String,
		required:false
	},
	slugify: String,
	name:{
		type: String,
		required: false
	},
	nativeName:{
		type: String,
		required:false
	}
});
module.exports =  mongoose.model('Language',LanguageSchema);