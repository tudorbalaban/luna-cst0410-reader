import { Router, json } from 'itty-router';
import { CST0410Reader } from '../core/reader';
import { ProcessRequest, JobStatus } from '../types/index';

const router = Router();

// In-memory job store (for demo; use KV in production)
const jobStore = new Map<string, JobStatus>();

router.use('*', (req) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
});

router.post('/api/v1/process', async (req) => {
  try {
    const payload = (await req.json()) as ProcessRequest;

    if (!payload.videoUrl) {
      return json({ error: 'videoUrl required' }, { status: 400 });
    }

    const jobId = payload.jobId || `job-${crypto.randomUUID()}`;

    const job: JobStatus = {
      jobId,
      status: 'QUEUED',
      videoUrl: payload.videoUrl,
      createdAt: new Date().toISOString(),
    };

    jobStore.set(jobId, job);

    console.log(`[POST /process] Job ${jobId} created, starting processing...`);

    const videoResp = await fetch(payload.videoUrl);
    if (!videoResp.ok) {
      job.status = 'FAILED';
      job.error = `Failed to fetch video: ${videoResp.statusText}`;
      jobStore.set(jobId, job);
      return json(job, { status: 400 });
    }

    const videoBuffer = await videoResp.arrayBuffer();

    const reader = new CST0410Reader(payload.config);
    const result = await reader.processVideo(videoBuffer);

    job.status = result.validation === 'PASSED' ? 'COMPLETED' : 'FAILED';
    job.result = result;
    job.completedAt = new Date().toISOString();

    jobStore.set(jobId, job);

    return json(job, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /process] Error:', msg);
    return json({ error: msg }, { status: 500 });
  }
});

router.get('/api/v1/jobs/:jobId', async (req) => {
  try {
    const { jobId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      return json({ error: 'Job not found' }, { status: 404 });
    }

    return json(job, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[GET /jobs/:jobId] Error:', msg);
    return json({ error: msg }, { status: 500 });
  }
});

router.get('/api/v1/health', () => {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

router.all('*', () => {
  return json({ error: 'Not found' }, { status: 404 });
});

export default router;
