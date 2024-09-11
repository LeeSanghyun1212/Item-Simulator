// src/routes/users.router.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/index.js'

const router = express.Router();

/** 사용자 회원가입 API **/
router.post('/sign-up', async (req, res, next) => {
  const { username, password, confirmPassword, name } = req.body;

  // 유효성 검사

  // 아이디 유효성 검사: 영어 소문자 + 숫자 조합 확인
  if (!/^[a-z0-9]+$/.test(username)) {
    return res.status(400).json({ message: '아이디는 영어 소문자와 숫자 조합이어야 합니다.' });
  }

  // 비밀번호 유효성 검사
  if (password.length < 6) {
    return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
  }

  // 아이디 중복 검사
  const isExistUser = await prisma.user.findUnique({
    where: {
      username,
    },
  });
  if (isExistUser) {
    return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
  }

  // 사용자 비밀번호를 암호화합니다.
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Users 테이블에 사용자를 추가합니다.
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword, // 암호화된 비밀번호를 저장합니다.
        name,
      },
    });

    return res.status(201).json({ 
      message: '회원가입이 완료되었습니다.',
      user: { id: user.id, username: user.username, name: user.name }
    });
  } catch (error) {
    return res.status(500).json({ message: '회원가입 중 오류가 발생했습니다.' });
  }
});

/** 로그인 API **/
router.post('/sign-in', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 유저 조회
    const user = await prisma.user.findUnique({ where: { username } });

    // 사용자 확인
    if (!user) {
      return res.status(401).json({ message: '존재하지 않는 사용자입니다.' });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    // 토큰 생성
    const token = jwt.sign(
      { userId: user.id }, // Prisma 스키마의 id 필드와 일치해야 함
      process.env.JWT_SECRET, // 비밀 키를 환경 변수로 설정
      { expiresIn: '3d' }    // 토큰 만료 시간 설정
    );

    // 쿠키에 토큰 저장
    res.cookie('authorization', `Bearer ${token}`, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production' 
    });

    return res.status(200).json({ message: '로그인 성공' });
  } catch (error) {
    console.error('로그인 처리 중 오류 발생:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
