exports.getMentorSloka = async (req, res) => {
  try {
    const { problem } = req.query; // e.g. stress, fear, anger
    if (!problem) {
      return res.status(400).json({ message: 'Problem keyword is required' });
    }

    // Find slokas that match the problem tag
    const slokas = await Sloka.find({ tags: { $regex: problem, $options: 'i' } });
    
    if (slokas.length === 0) {
      // Return a default motivating sloka if none found
      const defaultSloka = await Sloka.findOne();
      return res.json(defaultSloka);
    }

    // Pick a random one from the matching slokas
    const randomSloka = slokas[Math.floor(Math.random() * slokas.length)];
    res.json(randomSloka);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
