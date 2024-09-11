import express from 'express';
import cookieParser from 'cookie-parser';
import UsersRouter from './routes/users.route.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import charactersRouter from './routes/characters.route.js';
import ItemsRouter from './routes/item.route.js';

const app = express();
const PORT = 3018;

app.use(express.json());
app.use(cookieParser());
app.use('/api', [
  UsersRouter,
  charactersRouter,
  ItemsRouter,
]);

app.use('/api/protected', authMiddleware, (req, res) => {
  res.status(200).json({ message: '이 요청은 인증을 필요로 합니다.' });
});

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});