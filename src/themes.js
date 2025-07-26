export function viridis(t) {
  t = Math.max(0, Math.min(1, t))
  const c0 = [0.2777273272234177, 0.005407344544966578, 0.3340998053353061]
  const c1 = [0.1050930431085774, 1.404613529898575, 1.384590162594685]
  const c2 = [-0.3308618287255563, 0.214847559468213, 0.09509516302823659]
  const c3 = [-4.634230498983486, -5.799100973351585, -19.33244095627987]
  const c4 = [6.228269936347081, 14.17993336680509, 56.69055260068105]
  const c5 = [4.776384997670288, -13.74514537774601, -65.35303263337234]
  const c6 = [-5.435455855934631, 4.645852612178535, 26.3124352495832]

  const r = c0[0] + t * (c1[0] + t * (c2[0] + t * (c3[0] + t * (c4[0] + t * (c5[0] + t * c6[0])))))
  const g = c0[1] + t * (c1[1] + t * (c2[1] + t * (c3[1] + t * (c4[1] + t * (c5[1] + t * c6[1])))))
  const b = c0[2] + t * (c1[2] + t * (c2[2] + t * (c3[2] + t * (c4[2] + t * (c5[2] + t * c6[2])))))

  return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`
}

function heatDark(t) {
  t = Math.max(0, Math.min(1, t))

  // Much darker heat map - stays mostly black and dark red
  let r, g, b

  if (t < 0.7) {
    // Black to very dark red (70% of range stays very dark)
    const s = t / 0.7
    r = 0.3 * s * s * s // Cubic for even slower ramp
    g = 0
    b = 0
  } else if (t < 0.85) {
    // Dark red to medium red
    const s = (t - 0.7) / 0.15
    r = 0.3 + 0.4 * s
    g = 0
    b = 0
  } else if (t < 0.95) {
    // Red to orange (only top 15%)
    const s = (t - 0.85) / 0.1
    r = 0.7 + 0.3 * s
    g = 0.3 * s
    b = 0
  } else {
    // Orange to yellow (only top 5%)
    const s = (t - 0.95) / 0.05
    r = 1
    g = 0.3 + 0.7 * s
    b = 0
  }

  return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`
}

export function heat(t) {
  t = Math.max(0, Math.min(1, t))

  let r, g, b

  if (t < 0.5) {
    // Black to dark red (50% of range)
    const s = t / 0.5
    r = 0.5 * s * s // Quadratic for very gradual increase
    g = 0
    b = 0
  } else if (t < 0.75) {
    // Dark red to medium red
    const s = (t - 0.5) / 0.25
    r = 0.5 + 0.3 * s
    g = 0.1 * s * s // Very slight orange tint
    b = 0
  } else if (t < 0.9) {
    // Medium red to orange
    const s = (t - 0.75) / 0.15
    r = 0.8 + 0.2 * s
    g = 0.1 + 0.4 * s
    b = 0
  } else if (t < 0.98) {
    // Orange to yellow (only top 8%)
    const s = (t - 0.9) / 0.08
    r = 1
    g = 0.5 + 0.5 * s
    b = 0
  } else {
    // Yellow to white (only top 2%)
    const s = (t - 0.98) / 0.02
    r = 1
    g = 1
    b = s
  }

  return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`
}

export function plasma(t) {
  t = Math.max(0, Math.min(1, t))

  // Plasma colormap polynomial approximation
  const r = 0.05873234 + t * (2.176514 + t * (-2.68946 + t * (-2.748358 + t * (6.907711 + t * -2.492952))))
  const g = 0.0233367 + t * (0.2383834 + t * (0.8439317 + t * (0.06377434 + t * (-1.938038 + t * 1.758253))))
  const b = 0.5280456 + t * (0.8865128 + t * (-0.9652505 + t * (-1.02525 + t * (2.134871 + t * -0.5607338))))

  return `rgb(${Math.floor(Math.max(0, Math.min(1, r)) * 255)}, ${Math.floor(Math.max(0, Math.min(1, g)) * 255)}, ${Math.floor(Math.max(0, Math.min(1, b)) * 255)})`
}

export function turbo(t) {
  t = Math.max(0, Math.min(1, t))

  // Turbo colormap approximation
  const r = Math.max(0, Math.min(1, 0.13572 + t * (4.6149 + t * (-42.66 + t * (132.13 + t * (-152.94 + t * 62.85))))))
  const g = Math.max(0, Math.min(1, 0.0914 + t * (2.1957 + t * (4.663 + t * (-5.595 + t * 1.603)))))
  const b = Math.max(0, Math.min(1, 0.10667 + t * (12.471 + t * (-60.58 + t * (110.51 + t * (-89.9 + t * 27.34))))))

  return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`
}
