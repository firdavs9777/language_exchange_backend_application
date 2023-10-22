const Language = require("../models/Language")
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

exports.getLanguages = asyncHandler(async(req,res,next)=> {
 const languages = await Language.find();
	
 res.status(200).json({
  success: true,
  data: languages
  });
})