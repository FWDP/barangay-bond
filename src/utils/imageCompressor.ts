export async function compressImage(base64Data: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  if (!base64Data || !base64Data.startsWith("data:image")) {
    return base64Data;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Data);
      }
    };
    img.onerror = () => {
      resolve(base64Data);
    };
    img.src = base64Data;
  });
}
