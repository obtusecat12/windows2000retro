export interface TropicalVideoGenSpec {
  id: string;
  fileBase: string;
  referencePhotoPath: string;
  prompt: string;
  durationSec: 8 | 10;
  osdTopLeft: string;
  osdBottomLeft: string;
  introTitle?: string;
}

export const TROPICAL_VIDEO_GEN_SPECS: TropicalVideoGenSpec[] = [
  {
    id: 'video-tiki-lagoon-2000',
    fileBase: 'tiki_lagoon_2000',
    referencePhotoPath: 'public/media/photos/tiki_beach_2000.png',
    prompt:
      'Authentic Year-2000 consumer Sony Handycam home video footage animating this exact tropical Hawaii beach scene: turquoise ocean waves wash gently onto the white sandy shoreline, tall coconut palm fronds sway naturally in the coastal breeze, subtle realistic handheld camcorder movement, bright sunny tropical daylight, candid 2000 digital camcorder aesthetic.',
    durationSec: 8,
    osdTopLeft: 'PLAY',
    osdBottomLeft: '2000/05/04 14:20',
  },
  {
    id: 'video-tiki-sunset-torches',
    fileBase: 'tiki_sunset_torches',
    referencePhotoPath: 'public/media/photos/tiki_sunset_bar.png',
    prompt:
      'Authentic Year-2000 consumer camcorder home video animating this exact twilight beachside tiki bar scene: tiki torches flicker with lively glowing orange flames, gentle ocean waves shimmer against the warm sunset horizon, palm fronds sway in the evening breeze while guests chat casually beneath the thatched roof hut, realistic 2000 camcorder look.',
    durationSec: 8,
    osdTopLeft: 'SP  HI-FI',
    osdBottomLeft: '2000/07/24 19:05',
  },
  {
    id: 'video-tropical-tour-2000',
    fileBase: 'tropical_tour_2000',
    referencePhotoPath: 'public/media/photos/tiki_volcano_cove.png',
    prompt:
      'Authentic Year-2000 tropical island vacation documentary footage animating this exact Kauai emerald volcanic cove scene: turquoise harbor water ripples gently, small wooden boats bob lightly by the pier, tropical mist and sunlight shift softly across the green cliffs while palm leaves sway, realistic 2000 travelogue video aesthetic.',
    durationSec: 10,
    osdTopLeft: 'CH 03',
    osdBottomLeft: 'KAUAI COVE 2000',
    introTitle: 'TROPICAL ISLANDS\nVACATION TOUR 2000',
  },
];

export function buildRetroTranscodeArgs(opts: {
  inputPath: string;
  outputWebmPath: string;
  outputMp4Path: string;
  hasAudioStream: boolean;
  fontPath: string;
  spec: TropicalVideoGenSpec;
}): { webmArgs: string[]; mp4Args: string[] } {
  const { inputPath, outputWebmPath, outputMp4Path, hasAudioStream, fontPath, spec } = opts;
  const escapedTop = spec.osdTopLeft.replace(/:/g, '\\:');
  const escapedBot = spec.osdBottomLeft.replace(/:/g, '\\:');

  const vfChain = [
    'crop=ih*4/3:ih',
    'scale=320:240:flags=bilinear',
    'fps=15',
    'eq=contrast=1.06:saturation=0.92',
    'noise=alls=5:allf=t',
    `drawtext=fontfile=${fontPath}:text='${escapedTop}':x=10:y=10:fontsize=14:fontcolor=#FFE84C:shadowcolor=black:shadowx=1:shadowy=1`,
    `drawtext=fontfile=${fontPath}:text='${escapedBot}':x=10:y=218:fontsize=14:fontcolor=#FFE84C:shadowcolor=black:shadowx=1:shadowy=1`,
  ].join(',');

  if (hasAudioStream) {
    const webmArgs = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      vfChain,
      '-t',
      String(spec.durationSec),
      '-c:v',
      'libvpx',
      '-b:v',
      '380k',
      '-c:a',
      'libopus',
      '-b:a',
      '48k',
      outputWebmPath,
    ];
    const mp4Args = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      vfChain,
      '-t',
      String(spec.durationSec),
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline',
      '-level',
      '3.0',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '420k',
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      '-movflags',
      '+faststart',
      outputMp4Path,
    ];
    return { webmArgs, mp4Args };
  }

  // Synthesize gentle rolling surf ambience if source video has no audio track
  const surfInput = 'anoisesrc=color=pink:sample_rate=22050';
  const afFilter = 'lowpass=f=680,volume=0.14*(0.55+0.45*sin(2*PI*t/3.2)):eval=frame';

  const webmArgs = [
    '-y',
    '-i',
    inputPath,
    '-f',
    'lavfi',
    '-i',
    surfInput,
    '-vf',
    vfChain,
    '-af',
    afFilter,
    '-t',
    String(spec.durationSec),
    '-shortest',
    '-c:v',
    'libvpx',
    '-b:v',
    '380k',
    '-c:a',
    'libopus',
    '-b:a',
    '48k',
    outputWebmPath,
  ];

  const mp4Args = [
    '-y',
    '-i',
    inputPath,
    '-f',
    'lavfi',
    '-i',
    surfInput,
    '-vf',
    vfChain,
    '-af',
    afFilter,
    '-t',
    String(spec.durationSec),
    '-shortest',
    '-c:v',
    'libx264',
    '-profile:v',
    'baseline',
    '-level',
    '3.0',
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    '420k',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-movflags',
    '+faststart',
    outputMp4Path,
  ];

  return { webmArgs, mp4Args };
}
