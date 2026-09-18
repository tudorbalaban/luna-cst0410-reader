import { Router, json } from 'itty-router';
import { CST0410Reader } from '../core/reader';
import { Env, ProcessRequest, JobStatus } from '../types/index';

const router = Router<{ Bindings: Env }>();

router.use('*', (req, env) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
});

router.post<{ Bindings: Env }>('/api/v1/process', async (req, env) => {
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

    await env.KV_JOBS.put(jobId, JSON.stringify(job), { expirationTtl: 604800 });

    console.log(`[POST /process] Job ${jobId} created, starting processing...`);

    const videoResp = await fetch(payload.videoUrl);
    if (!videoResp.ok) {
      job.status = 'FAILED';
      job.error = `Failed to fetch video: ${videoResp.statusText}`;
      await env.KV_JOBS.put(jobId, JSON.stringify(job));
      return json(job, { status: 400 });
    }

    const videoBuffer = await videoResp.arrayBuffer();

    const reader = new CST0410Reader(payload.config);
    const result = await reader.processVideo(videoBuffer);

    job.status = result.validation === 'PASSED' ? 'COMPLETED' : 'FAILED';
    job.result = result;
    job.completedAt = new Date().toISOString();

    await env.KV_JOBS.put(jobId, JSON.stringify(job));

    await env.R2.put(`results/${jobId}.json`, JSON.stringify(result, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });

    return json(job, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /process] Error:', msg);
    return json({ error: msg }, { status: 500 });
  }
});

router.get<{ Bindings: Env }>('/api/v1/jobs/:jobId', async (req, env) => {
  try {
    const { jobId } = req.params;
    const jobData = await env.KV_JOBS.get(jobId);

    if (!jobData) {
      return json({ error: 'Job not found' }, { status: 404 });
    }

    const job = JSON.parse(jobData) as JobStatus;
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
