const SVG_URL =
  "https://raw.githubusercontent.com/AbdulDevHub/AbdulDevHub/main/profile-3d-contrib/profile-night-green.svg"

const COLOR_REPLACEMENTS = [
  // Background
  ["#00000f", "#0d1117"],

  // Level 1
  ["rgb(27, 125, 40)", "rgb(216, 232, 135)"],
  ["rgb(23, 105, 33)", "rgb(181, 194, 113)"],
  ["rgb(19, 88, 28)", "rgb(151, 162, 95)"],

  // Level 2
  ["rgb(36, 167, 54)", "rgb(140, 197, 105)"],
  ["rgb(30, 140, 45)", "rgb(117, 165, 88)"],
  ["rgb(25, 117, 38)", "rgb(98, 138, 74)"],

  // Level 3
  ["rgb(45, 209, 67)", "rgb(71, 160, 66)"],
  ["rgb(38, 175, 56)", "rgb(59, 134, 55)"],
  ["rgb(31, 146, 47)", "rgb(50, 112, 46)"],

  // Level 4
  ["rgb(87, 218, 105)", "rgb(29, 106, 35)"],
  ["rgb(73, 182, 88)", "rgb(24, 89, 29)"],
  ["rgb(61, 153, 74)", "rgb(20, 74, 25)"],

  // Tiles
  ["rgb(68, 68, 68)", "rgb(136, 136, 136)"],
  ["rgb(57, 57, 57)", "rgb(114, 114, 114)"],
  ["rgb(48, 48, 48)", "rgb(96, 96, 96)"],
]

function transformSVG(svg) {
  return COLOR_REPLACEMENTS.reduce(
    (modifiedSvg, [oldColor, newColor]) =>
      modifiedSvg.replaceAll(oldColor, newColor),
    svg,
  )
}

module.exports = { SVG_URL, transformSVG }
