# Job Crawler VN — Spec

## 1. Mục tiêu
Tool cá nhân tự động thu thập job **Frontend / Fullstack** tại thị trường **Việt Nam** từ nhiều nguồn, lọc theo config (level, kinh nghiệm, lương, địa điểm…), chuẩn hóa về 1 schema, chống trùng, lưu DB và gửi thông báo job mới mỗi ngày.

- Chạy **1 lần/ngày**, chi phí **0đ** (chỉ dùng free tier)
- Phạm vi: dùng cá nhân, crawl chậm & lịch sự (delay giữa request, tôn trọng rate limit)

## 2. Tech stack

| Phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript (Node 22), pnpm |
| Validate config & schema | Zod |
| Crawl trang VN | Crawlee + Cheerio (ưu tiên gọi API JSON nội bộ; Playwright chỉ khi bắt buộc) |
| LinkedIn + Indeed | JobSpy (Python) — 1 script in JSON ra stdout, Node gọi qua `execa` |
| Google Jobs | SerpApi + JSearch (RapidAPI) qua `fetch` |
| Chuẩn hóa | Regex/rule-based (LLM fallback: để sau) |
| Database | Supabase (Postgres) |
| Scheduler | GitHub Actions cron (1 lần/ngày) |
| Thông báo | Telegram Bot |
| Dashboard | Next.js + Vercel (giai đoạn 2, chưa làm) |

## 3. Nguồn crawl

| Nguồn | Cách lấy | Free quota | Ghi chú |
|---|---|---|---|
| **SerpApi** (Google Jobs) | API, `engine=google_jobs`, `gl=vn`, `hl=vi`, `location` | 250 search/tháng | Mỗi trang ≈ 10 job = 1 search. Gom TopCV, VietnamWorks, Indeed, LinkedIn… |
| **JSearch** (Google Jobs) | RapidAPI | 200 request/tháng, hard limit | Có sẵn field lương, employment type |
| **JobSpy – LinkedIn** | Scrape, `location="Ho Chi Minh City"` | Không giới hạn | Bị 429 nếu request dồn dập (hết sau ~1 phút). Có thể bị chặn IP GitHub Actions → fallback chạy local |
| **JobSpy – Indeed** | Scrape, `country_indeed="Vietnam"` | Không giới hạn | Ổn định nhất |
| **ITviec** | Tự viết adapter | Không giới hạn | Tìm API JSON nội bộ qua DevTools trước |
| **TopDev** | Tự viết adapter | Không giới hạn | Như trên |

**Không làm:** Facebook (cần login, chống bot gắt), LinkedIn qua tài khoản đăng nhập.

### Ngân sách quota (1 lần/ngày)
- 3 keyword × 2 thành phố = **6 query/ngày**
- SerpApi: 6 × 30 = 180/tháng ✅ — JSearch: 180/tháng ✅
- Quy tắc:
  - Mỗi query chỉ lấy **trang 1** + lọc tin đăng gần đây
  - Dừng phân trang khi gặp job đã có trong DB
  - Lưu lượt đã dùng mỗi nguồn trong DB, tự skip nguồn sắp hết quota
  - Khi dev/test: dùng response mẫu lưu trong `fixtures/*.json`, không gọi API thật

## 4. Config (`config.yaml`)

```yaml
keywords: ["frontend developer", "fullstack developer", "reactjs"]
locations: ["Ho Chi Minh City", "Hanoi"]
levels: ["junior", "middle", "senior"]
experience: { min: 1, max: 5 }
salary: { minVND: 20000000, includeNegotiable: true }
remote: any            # any | remote | onsite | hybrid
postedWithinDays: 3
sources:
  serpapi: { enabled: true, pagesPerQuery: 1 }
  jsearch: { enabled: true }
  jobspy:  { enabled: true, sites: ["linkedin", "indeed"] }
  itviec:  { enabled: true }
  topdev:  { enabled: true }
notify:
  telegram: { enabled: true, onlyMatched: true }
```

## 5. Schema job chuẩn hóa

```ts
type Job = {
  id: string;              // hash(normalize(company) + normalize(title) + city)
  title: string;
  company: string;
  city: string | null;
  level: "intern" | "junior" | "middle" | "senior" | "lead" | null;
  expMin: number | null; expMax: number | null;
  salaryMin: number | null; salaryMax: number | null;
  currency: "VND" | "USD" | null;
  negotiable: boolean;
  remote: "remote" | "onsite" | "hybrid" | null;
  skills: string[];
  sources: { site: string; url: string }[];  // 1 job có thể đến từ nhiều nguồn
  description: string;
  postedAt: string | null; firstSeenAt: string;
  matched: boolean;        // khớp config hay không
  status: "new" | "saved" | "applied" | "rejected";
};
```

### Quy tắc chuẩn hóa chính
- **Lương:** parse chuỗi như `"15 Tr ₫–22 Tr ₫ một tháng"`, `"Up to $2000"`, `"Thỏa thuận"` → min/max/currency/negotiable
- **Level:** tách từ title (Intern, Junior, Senior, Lead…)
- **Kinh nghiệm:** regex trên description (`"2 năm"`, `"3+ years"`…)
- **Ngày đăng:** quy đổi `"21 ngày trước"` → ngày thật tại thời điểm crawl
- **Dedupe:** trùng `id` → gộp thêm vào `sources`, không tạo bản ghi mới

## 6. Pipeline

```
config.yaml → Source adapters → Normalize → Dedupe → Supabase → Telegram (job mới + matched)
```

Mỗi source adapter implement chung 1 interface:

```ts
interface SourceAdapter {
  name: string;
  fetch(query: { keyword: string; location: string }): Promise<RawJob[]>;
  normalize(raw: RawJob): Job;
}
```

## 7. Lộ trình
1. **Phase 1:** config + SerpApi adapter + normalize + Supabase + Telegram
2. **Phase 2:** JobSpy (LinkedIn, Indeed), ITviec, TopDev, dedupe đa nguồn, GitHub Actions cron
3. **Phase 3:** Dashboard Next.js, LLM fallback cho normalize

## 8. Env cần có
```
SERPAPI_KEY=
RAPIDAPI_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```
