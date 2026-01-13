async function removeBg() {
  const fileInput = document.getElementById('imageInput');
  const resultDiv = document.getElementById('result');
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  resultDiv.innerHTML = '';
  resultDiv.appendChild(spinner);

  if (!fileInput.files[0]) {
    resultDiv.innerHTML = '<p style="color: red;">Select an image first!</p>';
    return;
  }

  const formData = new FormData();
  formData.append('image_file', fileInput.files[0]);
  formData.append('size', 'auto');

  try {
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': 'xv5aoeuirxTNZBYS5KykZZEK'
      },
      body: formData
    });

    spinner.remove();
    if (response.ok) {
      const blob = await response.blob();
      const imgUrl = URL.createObjectURL(blob);
      resultDiv.innerHTML = `<img src="${imgUrl}" alt="Processed Image" style="max-width: 100%; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: fadeInUp 1s;">`;
    } else {
      resultDiv.innerHTML = '<p style="color: red;">Error processing image. Check API key or try again.</p>';
    }
  } catch (error) {
    spinner.remove();
    resultDiv.innerHTML = '<p style="color: red;">Network error. Please try again.</p>';
  }
}
