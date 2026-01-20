export default async function handler(req, res) {
  try {
    // Fetch the original SVG
    const response = await fetch(
      'https://raw.githubusercontent.com/AbdulDevHub/AbdulDevHub/main/profile-3d-contrib/profile-night-green.svg'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch SVG');
    }
    
    let svg = await response.text();
    
    const changedBackground = svg.replace("#00000f", "#0d1117")
    const changedLV1 = changedBackground
      .replaceAll("rgb(27, 125, 40)", "rgb(216, 232, 135)")
      .replaceAll("rgb(23, 105, 33)", "rgb(181, 194, 113)")
      .replaceAll("rgb(19, 88, 28)", "rgb(151, 162, 95)")
    const changedLV2 = changedLV1.replaceAll(
      "rgb(36, 167, 54)",
      "rgb(140, 197, 105)",
    ).replaceAll(
      "rgb(30, 140, 45)",
      "rgb(117, 165, 88)",
    ).replaceAll(
      "rgb(25, 117, 38)",
      "rgb(98, 138, 74)",
    )
    const changedLV3 = changedLV2.replaceAll(
      "rgb(45, 209, 67)",
      "rgb(71, 160, 66)",
    ).replaceAll(
      "rgb(38, 175, 56)",
      "rgb(59, 134, 55)",
    ).replaceAll(
      "rgb(31, 146, 47)",
      "rgb(50, 112, 46)",
    )
    const changedLV4 = changedLV3.replaceAll(
      "rgb(87, 218, 105)",
      "rgb(29, 106, 35)",
    ).replaceAll(
      "rgb(73, 182, 88)",
      "rgb(24, 89, 29)",
    ).replaceAll(
      "rgb(61, 153, 74)",
      "rgb(20, 74, 25)",
    )
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    return res.status(200).send(changedLV4);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}