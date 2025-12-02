module.exports = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'API is working fine!'
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
