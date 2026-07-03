import axios from 'axios'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LIMIT = 100
const API_URL = `https://music.163.com/api/personalized/playlist?limit=${LIMIT}`
const OUTPUT = resolve(__dirname, '..', 'public', 'playlists.json')

async function main() {
  try {
    console.error(`正在请求 ${API_URL} ...`)
    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Referer: 'https://music.163.com/',
      },
    })

    const data = response.data
    if (data.code !== 200 || !Array.isArray(data.result)) {
      console.error('API 返回异常:', JSON.stringify(data).slice(0, 200))
      process.exit(1)
    }

    const playlists = data.result.map((item) => ({
      id: String(item.id),
      name: item.name || '',
      cover: item.picUrl || null,
    }))

    writeFileSync(OUTPUT, JSON.stringify(playlists, null, 2), 'utf-8')
    console.error(`✅ 成功写入 ${playlists.length} 个歌单到 ${OUTPUT}`)
  } catch (e) {
    console.error('请求失败:', e.message)
    process.exit(1)
  }
}

main()
