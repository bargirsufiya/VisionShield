/**
 * Foundry Processing Videos Configuration
 *
 * Videos are located in public/videos/
 * Only CCTV camera feeds included - they play natively in browsers
 */
export const FOUNDRY_VIDEOS = [
  {
    id: 'cctv_cam2',
    title: 'CCTV Camera 2 - Furnace Area',
    description: 'Live furnace monitoring feed from Camera 2',
    src: '/videos/cam2_web.mp4',
    duration: '6:05',
  },
  {
    id: 'foundry_pipeline',
    title: 'Foundry Demo Pipeline',
    description: 'Complete foundry process demonstration',
    src: '/videos/demo_foundry_pipeline_web.mp4',
    duration: '1:00',
  },
  {
    id: 'foundry_process',
    title: 'Foundry Process (2 min)',
    description: 'Short foundry process overview',
    src: '/videos/foundry_process_2min_web.mp4',
    duration: '2:05',
  },
];

export const DEFAULT_VIDEO_ID = 'cctv_cam2';

export function getVideoById(id) {
  return FOUNDRY_VIDEOS.find(v => v.id === id) || FOUNDRY_VIDEOS[0];
}

export function getDefaultVideo() {
  return getVideoById(DEFAULT_VIDEO_ID);
}