export function getPlayerImageUrl(player) {
  if (!player) return null;
  // prefer proxied CDN to avoid hotlink problems and to get thumbnails
  return player.imageProxy || player.image || null;
}
