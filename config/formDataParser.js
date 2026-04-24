import formidable from 'express-formidable';

export const parseFormData = formidable({
  encoding: 'utf-8',
  multiples: true,
  keepExtensions: true,
});