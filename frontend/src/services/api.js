export async function generateImage(text, imageFile) {
  const formData = new FormData()
  if (text) formData.append("text", text)
  if (imageFile) formData.append("image", imageFile)

  const response = await fetch("http://127.0.0.1:8000/generate", {
    method: "POST",
    body: formData,
  })

  return response.json()
}
