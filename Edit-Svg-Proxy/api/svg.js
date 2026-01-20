const { SVG_URL, transformSVG } = require('../lib/svg-transformer');

export default async function handler(req, res) {
  try {
    const response = await fetch(SVG_URL);
    
    if (!response.ok) {
      throw new Error('Failed to fetch SVG');
    }
    
    const svg = await response.text();
    const transformedSVG = transformSVG(svg);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    return res.status(200).send(transformedSVG);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}