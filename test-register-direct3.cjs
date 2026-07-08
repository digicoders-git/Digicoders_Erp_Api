const axios = require('axios');
const FormData = require('form-data');
async function test() {
  const form = new FormData();
  form.append('mobile', '9999999999');
  form.append('image', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' });
  try {
    const res = await axios.post('http://localhost:3001/api/registration/web/register-direct', form, {
      headers: form.getHeaders(),
    });
    console.log("Success:", res.status);
  } catch (err) {
    if (err.response) {
      console.log("Error status:", err.response.status);
      console.log("Error data:", err.response.data);
      // check if it's html
      if (typeof err.response.data === 'string' && err.response.data.includes('html')) {
        console.log("HTML response!");
      }
    } else {
      console.log("Error:", err.message);
    }
  }
}
test();
