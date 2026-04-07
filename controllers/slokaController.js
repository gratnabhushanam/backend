const { Sloka, Video } = require('../models');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const { mapSloka, mapVideo } = require('../utils/responseMappers');

let mockSlokas = [
  {
    id: 1001,
    chapter: 2,
    verse: 47,
    sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।',
    teluguMeaning: 'నీకు కర్మ చేయుటలోనే హక్కు కలదు, ఫలితంపై కాదు.',
    hindiMeaning: 'तुम्हारा अधिकार केवल कर्म करने में है, फल में कभी नहीं।',
    englishMeaning: 'You have a right to perform your duty, but not to the fruits of your actions.',
    simpleExplanation: 'Focus on sincere effort. Let go of anxiety about outcomes.',
    realLifeExample: 'Prepare well for exams and interviews without being consumed by result fear.',
    tags: ['stress', 'duty', 'focus', 'work'],
    isDaily: true,
  },
  {
    id: 1002,
    chapter: 6,
    verse: 5,
    sanskrit: 'उद्धरेदात्मनाऽत्मानं नात्मानमवसादयेत्।',
    teluguMeaning: 'మనిషి తనను తాను పైకి తీసుకోవాలి, దిగజార్చకూడదు.',
    hindiMeaning: 'मनुष्य को स्वयं अपने को ऊपर उठाना चाहिए, नीचे नहीं गिराना चाहिए।',
    englishMeaning: 'One must elevate oneself by the mind, not degrade oneself.',
    simpleExplanation: 'Your inner attitude can either lift you or pull you down.',
    realLifeExample: 'Replace self-criticism with disciplined daily habits and positive self-talk.',
    tags: ['motivation', 'discipline', 'confidence'],
    isDaily: true,
  },
  {
    id: 1003,
    chapter: 4,
    verse: 39,
    sanskrit: 'श्रद्धावान् लभते ज्ञानं तत्परः संयतेन्द्रियः।',
    teluguMeaning: 'శ్రద్ధ కలవారికి జ్ఞానం లభిస్తుంది.',
    hindiMeaning: 'श्रद्धावान और संयमी व्यक्ति ज्ञान प्राप्त करता है।',
    englishMeaning: 'The faithful and disciplined gain wisdom.',
    simpleExplanation: 'Faith plus consistent practice leads to clarity.',
    realLifeExample: 'When confused, keep learning and practicing patiently instead of quitting.',
    tags: ['confusion', 'clarity', 'faith', 'learning'],
    isDaily: true,
  },
  {
    id: 1004,
    chapter: 2,
    verse: 56,
    sanskrit: 'दुःखेष्वनुद्विग्नमनाः सुखेषु विगतस्पृहः।',
    teluguMeaning: 'దుఃఖంలో కలవరపడని, సుఖంలో ఆసక్తి చెందని వాడు స్థిరబుద్ధి.',
    hindiMeaning: 'जो दुःख में विचलित न हो और सुख में आसक्त न हो, वही स्थिरबुद्धि है।',
    englishMeaning: 'One who is not disturbed in sorrow and not attached in joy is steady in wisdom.',
    simpleExplanation: 'Emotional balance reduces fear and panic in uncertain times.',
    realLifeExample: 'Before exams or interviews, calm your breath and focus on effort, not panic.',
    tags: ['fear', 'courage', 'stability', 'calm'],
    isDaily: true,
  },
  {
    id: 1005,
    chapter: 2,
    verse: 63,
    sanskrit: 'क्रोधाद्भवति सम्मोहः सम्मोहात्स्मृतिविभ्रमः।',
    teluguMeaning: 'కోపం నుండి మోహం, మోహం నుండి స్మృతి భ్రంశం కలుగుతుంది.',
    hindiMeaning: 'क्रोध से मोह उत्पन्न होता है, मोह से स्मृति भ्रमित हो जाती है।',
    englishMeaning: 'From anger comes delusion; from delusion, memory is confused.',
    simpleExplanation: 'Anger clouds judgment and makes decisions worse.',
    realLifeExample: 'When angry in a conversation, pause and respond after a few breaths.',
    tags: ['anger', 'self-control', 'mindfulness', 'calm'],
    isDaily: true,
  },
];

let nextMockSlokaId = 2000;
let mockDailyHistory = [];
let mockMentorHistory = [];

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).toLowerCase());
  if (typeof tags === 'string') {
    const value = tags.trim();
    if (!value) return [];

    // Handle serialized JSON arrays stored as strings.
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((tag) => String(tag).toLowerCase());
        }
      } catch (error) {
        // Fall through to comma-split fallback.
      }
    }

    return value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const getProblemMockFallback = (problem) => {
  const matched = mockSlokas.filter((sloka) => normalizeTags(sloka.tags).some((tag) => tag.includes(problem)));
  if (matched.length) return matched[0];

  const problemPriority = {
    stress: 1001,
    motivation: 1002,
    confusion: 1003,
    fear: 1004,
    anger: 1005,
  };

  const preferredId = problemPriority[problem];
  if (preferredId) {
    const preferred = mockSlokas.find((item) => Number(item.id) === preferredId);
    if (preferred) return preferred;
  }

  return mockSlokas[0];
};

const resolveDailySeed = (inputDate) => {
  const parsedDate = inputDate ? new Date(inputDate) : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const yyyy = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  const isoDay = `${yyyy}-${month}-${day}`;

  const dayStart = new Date(yyyy, safeDate.getMonth(), safeDate.getDate());
  const dayIndex = Math.floor(dayStart.getTime() / (1000 * 60 * 60 * 24));
  return { isoDay, dayIndex };
};

const getLocalizedMeaning = (sloka) => ({
  english: sloka.englishMeaning || '',
  telugu: sloka.teluguMeaning || sloka.englishMeaning || '',
  hindi: sloka.hindiMeaning || sloka.englishMeaning || '',
});

const getAudioByLanguage = (sloka) => {
  const fallback = sloka.audioUrl || '';
  return {
    english: sloka.audioUrlEnglish || fallback,
    telugu: sloka.audioUrlTelugu || fallback,
    hindi: sloka.audioUrlHindi || fallback,
  };
};

const mentorContentBank = {
  stress: {
    title: 'Release the pressure',
    tip: 'Do your duty steadily. Do not measure your peace by immediate results.',
    practice: 'Take 3 slow breaths before every important task and focus only on the next step.',
  },
  fear: {
    title: 'Stand without fear',
    tip: 'Fear becomes smaller when you act with trust and discipline.',
    practice: 'Write down the one thing you fear, then take one small action toward it today.',
  },
  confusion: {
    title: 'Bring clarity first',
    tip: 'Confusion clears when you simplify, reflect, and keep learning.',
    practice: 'Choose one question, one verse, and one action for today. Avoid overload.',
  },
  anger: {
    title: 'Convert anger to strength',
    tip: 'Pause before reacting. Strength is using energy with awareness, not impulse.',
    practice: 'Count to ten, step away for a minute, and respond only after your breath settles.',
  },
  motivation: {
    title: 'Move with purpose',
    tip: 'Motivation grows when daily effort is tied to a meaningful goal.',
    practice: 'Start with 10 minutes of focused work and repeat it daily for one week.',
  },
};

const getMentorMeta = (problem) => {
  const normalized = String(problem || '').trim().toLowerCase();
  return mentorContentBank[normalized] || {
    title: 'Seek guidance with patience',
    tip: 'Return to the verse, keep practicing, and let the meaning settle over time.',
    practice: 'Read the verse once in the morning and once at night for 3 days.',
  };
};

exports.getSlokas = async (req, res) => {
  try {
    const slokas = await Sloka.findAll();
    res.json(slokas.map(mapSloka));
  } catch (error) {
    res.json(mockSlokas.map(mapSloka));
  }
};

exports.getSlokaById = async (req, res) => {
  try {
    const slokaId = Number(req.params.id);
    if (!slokaId) {
      return res.status(400).json({ message: 'Valid sloka id is required' });
    }

    try {
      const sloka = await Sloka.findByPk(slokaId);
      if (sloka) {
        return res.json(mapSloka(sloka));
      }
    } catch (dbError) {
      // fall back to mock data below
    }

    const mockSloka = mockSlokas.find((item) => Number(item.id) === slokaId);
    if (mockSloka) {
      return res.json(mapSloka(mockSloka));
    }

    return res.status(404).json({ message: 'Sloka not found' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDailySloka = async (req, res) => {
  try {
    const { isoDay, dayIndex } = resolveDailySeed(req.query.date);

    let pool = await Sloka.findAll({ where: { isDaily: true }, order: [['id', 'ASC']] });
    if (!pool.length) {
      pool = await Sloka.findAll({ order: [['id', 'ASC']] });
    }

    if (!pool.length) {
      const selectedMock = mockSlokas[dayIndex % mockSlokas.length];
      return res.json({
        ...mapSloka(selectedMock),
        localizedMeaning: getLocalizedMeaning(selectedMock),
        audioByLanguage: getAudioByLanguage(selectedMock),
        dailyKey: isoDay,
        source: 'mock',
      });
    }

    const selected = pool[dayIndex % pool.length];
    return res.json({
      ...mapSloka(selected),
      localizedMeaning: getLocalizedMeaning(selected),
      audioByLanguage: getAudioByLanguage(selected),
      dailyKey: isoDay,
    });
  } catch (error) {
    const { isoDay, dayIndex } = resolveDailySeed(req.query.date);
    const selected = mockSlokas[dayIndex % mockSlokas.length];
    return res.json({
      ...mapSloka(selected),
      localizedMeaning: getLocalizedMeaning(selected),
      audioByLanguage: getAudioByLanguage(selected),
      dailyKey: isoDay,
      source: 'mock',
    });
  }
};

exports.addSloka = async (req, res) => {
  try {
    const newSloka = await Sloka.create(req.body);
    res.status(201).json(mapSloka(newSloka));
  } catch (error) {
    const payload = req.body || {};

    if (!payload.chapter || !payload.verse || !payload.sanskrit || !payload.teluguMeaning || !payload.englishMeaning) {
      return res.status(400).json({
        message: 'chapter, verse, sanskrit, teluguMeaning and englishMeaning are required',
      });
    }

    const created = {
      id: nextMockSlokaId++,
      chapter: Number(payload.chapter),
      verse: Number(payload.verse),
      sanskrit: payload.sanskrit,
      teluguMeaning: payload.teluguMeaning,
      hindiMeaning: payload.hindiMeaning || '',
      englishMeaning: payload.englishMeaning,
      simpleExplanation: payload.simpleExplanation || '',
      realLifeExample: payload.realLifeExample || '',
      audioUrl: payload.audioUrl || '',
      audioUrlEnglish: payload.audioUrlEnglish || payload.audioUrl || '',
      audioUrlTelugu: payload.audioUrlTelugu || payload.audioUrl || '',
      audioUrlHindi: payload.audioUrlHindi || payload.audioUrl || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      isDaily: Boolean(payload.isDaily),
      source: 'mock',
    };

    mockSlokas.push(created);
    return res.status(201).json(mapSloka(created));
  }
};

exports.getMentorSloka = async (req, res) => {
  try {
    const problem = String(req.query.problem || req.query.issue || req.query.topic || '').trim().toLowerCase();
    if (!problem) {
      return res.status(400).json({ message: 'Problem keyword is required' });
    }

    const mentorMeta = getMentorMeta(problem);

    const allSlokas = await Sloka.findAll();
    const slokas = allSlokas.filter((sloka) => normalizeTags(sloka.tags).some((tag) => tag.includes(problem)));
    
    if (slokas.length === 0) {
      const safeFallback = getProblemMockFallback(problem);
      const base = safeFallback ? mapSloka(safeFallback) : {};
      return res.json({
        ...base,
        problem,
        mentorTitle: mentorMeta.title,
        mentorTip: mentorMeta.tip,
        mentorPractice: mentorMeta.practice,
        localizedMeaning: safeFallback ? getLocalizedMeaning(safeFallback) : {},
        audioByLanguage: safeFallback ? getAudioByLanguage(safeFallback) : {},
        source: 'mock-problem-fallback',
      });
    }

    const randomSloka = slokas[Math.floor(Math.random() * slokas.length)];
    
    // Search related video
    const relatedVideo = await Video.findOne({ where: { tags: { [Op.like]: `%${problem}%` } } });

    res.json({
      ...mapSloka(randomSloka),
      localizedMeaning: getLocalizedMeaning(randomSloka),
      audioByLanguage: getAudioByLanguage(randomSloka),
      problem,
      mentorTitle: mentorMeta.title,
      mentorTip: mentorMeta.tip,
      mentorPractice: mentorMeta.practice,
      recommendedVideo: relatedVideo ? mapVideo(relatedVideo) : null
    });

  } catch (error) {
    const problem = String(req.query.problem || req.query.issue || req.query.topic || '').trim().toLowerCase();
    if (!problem) {
      return res.status(400).json({ message: 'Problem keyword is required' });
    }

    const fallback = getProblemMockFallback(problem);
    const mentorMeta = getMentorMeta(problem);

    return res.json({
      ...mapSloka(fallback),
      localizedMeaning: getLocalizedMeaning(fallback),
      audioByLanguage: getAudioByLanguage(fallback),
      problem,
      mentorTitle: mentorMeta.title,
      mentorTip: mentorMeta.tip,
      mentorPractice: mentorMeta.practice,
      recommendedVideo: null,
      source: 'mock',
    });
  }

};

exports.getMentorContent = async (req, res) => {
  try {
    const problem = String(req.query.problem || req.query.issue || req.query.topic || '').trim().toLowerCase();
    if (!problem) {
      return res.status(400).json({ message: 'Problem keyword is required' });
    }

    const { Story, Video } = require('../models');
    const mentorMeta = getMentorMeta(problem);

    // Fetch multiple related slokas
    const allSlokas = await Sloka.findAll();
    const relatedSlokas = allSlokas
      .filter((sloka) => normalizeTags(sloka.tags).some((tag) => tag.includes(problem)))
      .slice(0, 6)
      .map((sloka) => ({
        ...mapSloka(sloka),
        localizedMeaning: getLocalizedMeaning(sloka),
        audioByLanguage: getAudioByLanguage(sloka),
      }));

    // Fallback to mock data if database is empty
    let finalSlokas = relatedSlokas;
    if (finalSlokas.length === 0) {
      finalSlokas = mockSlokas
        .filter((sloka) => normalizeTags(sloka.tags).some((tag) => tag.includes(problem)))
        .slice(0, 6)
        .map((sloka) => ({
          ...mapSloka(sloka),
          localizedMeaning: getLocalizedMeaning(sloka),
          audioByLanguage: getAudioByLanguage(sloka),
        }));

      if (finalSlokas.length === 0) {
        const fallback = getProblemMockFallback(problem);
        finalSlokas = [
          {
            ...mapSloka(fallback),
            localizedMeaning: getLocalizedMeaning(fallback),
            audioByLanguage: getAudioByLanguage(fallback),
          },
        ];
      }
    }

    // Fetch related stories
    const relatedStories = await Story.findAll({ limit: 4, raw: true }).catch(() => []);

    // Fetch related videos
    const relatedVideos = await Video.findAll({ limit: 4, raw: true }).catch(() => []);

    res.json({
      problem,
      mentorTitle: mentorMeta.title,
      mentorTip: mentorMeta.tip,
      mentorPractice: mentorMeta.practice,
      slokas: finalSlokas,
      stories: relatedStories,
      videos: relatedVideos,
    });
  } catch (error) {
    console.error('Error fetching mentor content:', error);
    const problem = String(req.query.problem || req.query.issue || req.query.topic || '').trim().toLowerCase();
    const mentorMeta = getMentorMeta(problem);

    const relatedMockSlokas = mockSlokas
      .filter((sloka) => normalizeTags(sloka.tags).some((tag) => tag.includes(problem)))
      .slice(0, 6)
      .map((sloka) => ({
        ...mapSloka(sloka),
        localizedMeaning: getLocalizedMeaning(sloka),
        audioByLanguage: getAudioByLanguage(sloka),
      }));

    res.json({
      problem,
      mentorTitle: mentorMeta.title,
      mentorTip: mentorMeta.tip,
      mentorPractice: mentorMeta.practice,
      slokas: relatedMockSlokas,
      stories: [],
      videos: [],
      source: 'mock',
    });
  }
};

exports.getDailyHistory = async (req, res) => {
  try {
    return res.json({ items: mockDailyHistory.slice(0, 50) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.addDailyHistory = async (req, res) => {
  try {
    const payload = req.body || {};
    const entry = {
      id: payload.id || null,
      chapter: payload.chapter || null,
      verse: payload.verse || null,
      sanskrit: payload.sanskrit || '',
      englishMeaning: payload.englishMeaning || '',
      dailyKey: payload.dailyKey || new Date().toISOString().slice(0, 10),
      viewedAt: payload.viewedAt || new Date().toISOString(),
    };

    mockDailyHistory = [entry, ...mockDailyHistory.filter((item) => !(item.dailyKey === entry.dailyKey && item.id === entry.id))].slice(0, 50);
    return res.status(201).json({ message: 'Daily history saved', item: entry });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMentorHistory = async (req, res) => {
  try {
    return res.json({ items: mockMentorHistory.slice(0, 50) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.addMentorHistory = async (req, res) => {
  try {
    const payload = req.body || {};
    const entry = {
      problem: payload.problem || '',
      sanskrit: payload.sanskrit || '',
      englishMeaning: payload.englishMeaning || '',
      mentorTitle: payload.mentorTitle || '',
      viewedAt: payload.viewedAt || new Date().toISOString(),
    };

    mockMentorHistory = [entry, ...mockMentorHistory.filter((item) => !(item.problem === entry.problem && item.sanskrit === entry.sanskrit))].slice(0, 50);
    return res.status(201).json({ message: 'Mentor history saved', item: entry });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
