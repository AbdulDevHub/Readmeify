const https = require('https');
const { SVG_URL, transformSVG } = require('../../lib/svg-transformer');

function fetchSVG(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', reject);
  });
}

exports.handler = async function (event, context) {
  try {
    const svg = await fetchSVG(SVG_URL);
    const transformedSVG = transformSVG(svg);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
      body: transformedSVG,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};