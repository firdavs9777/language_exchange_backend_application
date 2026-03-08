const mongoose = require('mongoose');
const slugify = require('slugify');

const LanguageSchema = new mongoose.Schema({
	code: {
		type: String,
		required: true,
		unique: true,
		index: true
	},
	slugify: String,
	name: {
		type: String,
		required: true
	},
	nativeName: {
		type: String,
		required: true
	},
	flag: {
		type: String,
		required: false
	}
});

// Create slug from name
LanguageSchema.pre('save', function(next) {
	if (this.name) {
		this.slugify = slugify(this.name, { lower: true });
	}
	next();
});

module.exports = mongoose.model('Language', LanguageSchema);