const axios = require('axios');
const FormData = require('form-data');
async function test() {
  const form = new FormData();
  form.append('mobile', '9999999999');
  form.append('studentName', 'Test Student');
  form.append('training', '60c5a2c1b2f7a5528c0a8a11'); // dummy id
  form.append('technology', '60c5a2c1b2f7a5528c0a8a12'); // dummy id
  form.append('paymentType', 'registration');
  try {
    const res = await axios.post('http://localhost:3001/api/registration/web/register-direct', form, {
      headers: form.getHeaders(),
    });
    console.log("Success:", res.status);
  } catch (err) {
    if (err.response) {
      console.log("Error status:", err.response.status);
      console.log("Error data:", err.response.data);
    } else {
      console.log("Error:", err.message);
    }
  }
}
test();
