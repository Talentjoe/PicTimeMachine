import { useState } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Link,
} from '@mui/material';
import cookie from 'react-cookies';
import theme from './theme';
import PhotoTrackPage from './features/photo-track/PhotoTrackPage';

const WELCOME_LINES = [
  '该网站是一个基于 React 和 Leaflet 的纯前端地图应用。',
  '它通过读取图片 EXIF 中的 GPS 信息，在地图上标记您的轨迹，带您重温过去的时光。',
  '本网站为静态网站，虽然显示为“上传”，其实并未真正上传，不必担心照片泄露。',
  '请准备一个含有图片的文件夹，且图片 EXIF 中的 GPS 信息未受损（微信图片可能无法使用）。',
  '点击左侧“导入”选择图片，它们会进入素材库；确认成功识别的数量。',
  '像剪辑视频一样：把图片或组合加入下方时间线，可重复出现、可留空（空白片段）、也可不加入。',
  '点选时间线上的片段可调整“移动”（地图飞行动画时长）与“停留”时间。',
  '如果您在国内，请将地图切换为“中国”；否则推荐使用 OSM。',
  '随后点击播放按钮，希望能带您走上回忆过去的旅程！该提示仅会显示一次。',
];

function App() {
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => {
    try {
      return !cookie.load('viewed');
    } catch (e) {
      console.log(e);
      return true;
    }
  });

  const closeWelcome = () => {
    cookie.save('viewed', true, { path: '/' });
    setWelcomeOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PhotoTrackPage />

      <Dialog open={welcomeOpen} onClose={closeWelcome} maxWidth="sm">
        <DialogTitle>欢迎来到图片时光机</DialogTitle>
        <DialogContent>
          {WELCOME_LINES.map((line, i) => (
            <DialogContentText key={i} sx={{ mb: 1 }}>
              {line}
            </DialogContentText>
          ))}
          <DialogContentText sx={{ mb: 1 }}>
            开源地址：
            <Link href="https://github.com/Talentjoe/PicTimeMachine" target="_blank" rel="noopener">
              github.com/Talentjoe/PicTimeMachine
            </Link>
          </DialogContentText>
          <DialogContentText>该项目致亲爱的老妈！</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeWelcome} variant="contained">
            开始使用
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
