import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerDocument } from './swagger';
import { errorMiddleware } from './middleware/error';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import voiceRoutes from './routes/voice';
import swipeRoutes from './routes/swipe';
import matchRoutes from './routes/match';
import messageRoutes from './routes/message';
import blockRoutes from './routes/block';
import reportRoutes from './routes/report';
import preferenceRoutes from './routes/preference';

export const app = express();

app.use(cors());
app.use(express.json());

// Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/discover', swipeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/matches', messageRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/preferences', preferenceRoutes);

// Error handling
app.use(errorMiddleware);

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}
