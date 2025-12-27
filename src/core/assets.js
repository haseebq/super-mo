export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export async function loadJson(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load json: ${src}`);
  }
  return response.json();
}
