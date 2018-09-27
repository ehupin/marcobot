
const qs = require('qs');

const crypto = require('crypto');
import axios from 'axios'

export async function signedRequest(config, data, endPoint, type){
  const dataQueryString = qs.stringify(data);
  const signature = crypto.createHmac('sha256', config.API_SECRET).update(dataQueryString).digest('hex');
  const requestConfig = {
    method: type,
    url: config.HOST_URL + endPoint + '?' + dataQueryString + '&signature=' + signature,
    headers: {
        'X-MBX-APIKEY': config.API_KEY,
    },
  };
  
  const response = await axios(requestConfig);
  return response

  try {
    const response = await axios(requestConfig);
    return response;
  }
  catch (err) {
    console.log(err);
    return err;
  }
};