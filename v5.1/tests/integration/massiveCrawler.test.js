const request = require('supertest');
const express = require('express');
const massiveCrawlerRoutes = require('../../server/routes/massiveCrawler');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/massive-crawler', massiveCrawlerRoutes);

describe('Massive Crawler API Integration Tests', () => {
  let sessionId;
  const testUrl = 'https://httpbin.org';

  describe('POST /api/massive-crawler/start', () => {
    test('should start crawling with valid URL', async () => {
      const response = await request(app)
        .post('/api/massive-crawler/start')
        .send({
          url: testUrl,
          options: {
            crawler: {
              maxConcurrency: 2,
              maxDepth: 2,
              rateLimitDelay: 1000
            }
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.status).toBe('started');
      
      sessionId = response.body.sessionId;
    });

    test('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/api/massive-crawler/start')
        .send({
          url: 'invalid-url'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_URL');
    });

    test('should reject missing URL', async () => {
      const response = await request(app)
        .post('/api/massive-crawler/start')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_URL');
    });
  });

  describe('GET /api/massive-crawler/status/:sessionId', () => {
    test('should return crawling status for valid session', async () => {
      if (!sessionId) {
        // Create a session first
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/status/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.status).toBeDefined();
      expect(response.body.stats).toBeDefined();
      expect(response.body.queueStats).toBeDefined();
      expect(response.body.reportStats).toBeDefined();
    });

    test('should return 404 for invalid session', async () => {
      const response = await request(app)
        .get('/api/massive-crawler/status/invalid-session-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('GET /api/massive-crawler/stats/:sessionId', () => {
    test('should return comprehensive statistics', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/stats/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.crawler).toBeDefined();
      expect(response.body.queue).toBeDefined();
      expect(response.body.rateLimiter).toBeDefined();
      expect(response.body.retry).toBeDefined();
      expect(response.body.duplicate).toBeDefined();
      expect(response.body.report).toBeDefined();
    });
  });

  describe('GET /api/massive-crawler/sessions', () => {
    test('should return list of all sessions', async () => {
      const response = await request(app)
        .get('/api/massive-crawler/sessions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toBeDefined();
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.total).toBeDefined();
    });
  });

  describe('PUT /api/massive-crawler/config/:sessionId', () => {
    test('should update configuration for valid session', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const newConfig = {
        rateLimiter: {
          defaultDelay: 2000,
          maxDelay: 20000
        },
        retry: {
          maxAttempts: 5
        }
      };

      const response = await request(app)
        .put(`/api/massive-crawler/config/${sessionId}`)
        .send({ config: newConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Configuration updated successfully');
    });

    test('should reject missing configuration', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .put(`/api/massive-crawler/config/${sessionId}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_CONFIG');
    });
  });

  describe('POST /api/massive-crawler/stop/:sessionId', () => {
    test('should stop crawling for valid session', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .post(`/api/massive-crawler/stop/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('stopped');
    });

    test('should return 404 for invalid session', async () => {
      const response = await request(app)
        .post('/api/massive-crawler/stop/invalid-session-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('GET /api/massive-crawler/pages/:sessionId', () => {
    test('should return paginated pages list', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/pages/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pages).toBeDefined();
      expect(Array.isArray(response.body.pages)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
    });

    test('should support pagination parameters', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/pages/${sessionId}?page=2&limit=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
    });

    test('should support status filtering', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/pages/${sessionId}?status=processed`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pages).toBeDefined();
    });
  });

  describe('GET /api/massive-crawler/errors/:sessionId', () => {
    test('should return paginated errors list', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/errors/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/massive-crawler/rate-limit/:sessionId/:domain', () => {
    test('should set domain rate limit', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .post(`/api/massive-crawler/rate-limit/${sessionId}/httpbin.org`)
        .send({ delay: 5000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.delay).toBe(5000);
      expect(response.body.domain).toBe('httpbin.org');
    });

    test('should reject invalid delay', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .post(`/api/massive-crawler/rate-limit/${sessionId}/httpbin.org`)
        .send({ delay: -100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_DELAY');
    });
  });

  describe('GET /api/massive-crawler/rate-limit/:sessionId/:domain', () => {
    test('should return domain rate limiter statistics', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      // First set a rate limit
      await request(app)
        .post(`/api/massive-crawler/rate-limit/${sessionId}/httpbin.org`)
        .send({ delay: 3000 });

      const response = await request(app)
        .get(`/api/massive-crawler/rate-limit/${sessionId}/httpbin.org`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.domain).toBe('httpbin.org');
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.currentDelay).toBe(3000);
    });
  });

  describe('DELETE /api/massive-crawler/session/:sessionId', () => {
    test('should delete session successfully', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .delete(`/api/massive-crawler/session/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session deleted successfully');
    });

    test('should return 404 for invalid session', async () => {
      const response = await request(app)
        .delete('/api/massive-crawler/session/invalid-session-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('GET /api/massive-crawler/report/:sessionId', () => {
    test('should return discovery report', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/report/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.report).toBeDefined();
    });

    test('should support different export formats', async () => {
      if (!sessionId) {
        const startResponse = await request(app)
          .post('/api/massive-crawler/start')
          .send({ url: testUrl });
        sessionId = startResponse.body.sessionId;
      }

      const response = await request(app)
        .get(`/api/massive-crawler/report/${sessionId}?format=csv`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.format).toBe('csv');
      expect(response.body.exportedFile).toBeDefined();
    });
  });

  // Cleanup
  afterAll(async () => {
    if (sessionId) {
      try {
        await request(app)
          .delete(`/api/massive-crawler/session/${sessionId}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
});
