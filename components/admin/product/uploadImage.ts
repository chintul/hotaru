import { upload } from '@imagekit/next'

interface UploadAuth {
  token: string
  signature: string
  expire: number
  publicKey: string
}

export async function uploadProductImage(file: File, productSlug: string) {
  const authRes = await fetch('/api/upload-auth')
  if (!authRes.ok) {
    throw new Error(authRes.status === 403
      ? 'Админ эрх шаардлагатай.'
      : 'Байршуулах эрх авахад алдаа гарлаа.')
  }
  const { token, signature, expire, publicKey }: UploadAuth = await authRes.json()

  return upload({
    file,
    fileName: `${productSlug}-${Date.now()}-${file.name}`,
    folder: `/hotaru/${productSlug}`,
    useUniqueFileName: true,
    publicKey,
    token,
    signature,
    expire,
  })
}
