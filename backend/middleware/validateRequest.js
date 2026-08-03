const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
);

const isNonEmptyString = (value) => (
  typeof value === 'string'
  && value.trim().length > 0
);

const isOptionalString = (value) => (
  value === undefined
  || value === null
  || typeof value === 'string'
);

const isPositiveIntLike = (value) => {
  if (value === undefined || value === null || value === '') return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === String(value).trim();
};

const { isVisGrade, isVisSkill } = require('../config/visCodes');

const validators = {
  login(body) {
    if (!isNonEmptyString(body.username)) return 'Username is required';
    if (!isNonEmptyString(body.password)) return 'Password is required';
    return null;
  },

  register(body) {
    if (!isNonEmptyString(body.username)) return 'Username is required';
    if (!isNonEmptyString(body.password) || body.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (body.role !== undefined && body.role !== 'team_staff') {
      return 'Invalid role';
    }
    if (!isNonEmptyString(body.name)) return 'Team name is required for team staff registration';
    if (!isNonEmptyString(body.code)) return 'Team code is required for team staff registration';
    if (!isOptionalString(body.email)) return 'Email must be a string';
    if (!isOptionalString(body.phone)) return 'Phone must be a string';
    return null;
  },

  uploadImage(body) {
    if (!isNonEmptyString(body.image)) return 'Image data is required';
    if (!/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(body.image)) {
      return 'Invalid image data';
    }
    return null;
  },

  createMatch(body) {
    if (!isPositiveIntLike(body.competition_id)) return 'Competition ID is required';
    if (!isPositiveIntLike(body.home_team_id)) return 'Home team is required';
    if (!isPositiveIntLike(body.away_team_id)) return 'Away team is required';
    if (String(body.home_team_id) === String(body.away_team_id)) {
      return 'Home team and away team must be different';
    }
    if (!isNonEmptyString(body.round_name)) return 'Round name is required';
    if (body.status && !['scheduled', 'live', 'completed', 'cancelled'].includes(String(body.status).toLowerCase())) {
      return 'Invalid match status';
    }
    return null;
  },

  updateMatchResult(body) {
    if (!['scheduled', 'live', 'completed', 'cancelled'].includes(String(body.status || '').toLowerCase())) {
      return 'Invalid match status';
    }
    if (body.home_set_score === undefined || Number.isNaN(Number(body.home_set_score))) {
      return 'Home set score is required';
    }
    if (body.away_set_score === undefined || Number.isNaN(Number(body.away_set_score))) {
      return 'Away set score is required';
    }
    if (body.set_scores !== undefined) {
      try {
        const parsed = typeof body.set_scores === 'string' ? JSON.parse(body.set_scores) : body.set_scores;
        if (!Array.isArray(parsed)) return 'Set scores must be an array';
      } catch {
        return 'Set scores must be valid JSON';
      }
    }
    return null;
  },

  scorerEvent(body) {
    if (!isPositiveIntLike(body.set_number)) return 'Set number is required';
    if (!body.event_type && !body.skill) return 'Event type or skill is required';

    const skill = body.skill || body.event_type;
    const hasVisGrade = body.grade !== undefined && body.grade !== null && body.grade !== '';
    if (hasVisGrade) {
      if (!isVisSkill(skill)) return 'Invalid VIS skill';
      if (!isVisGrade(body.grade)) return 'Invalid VIS grade';
      if (!isPositiveIntLike(body.player_id)) return 'Player is required for VIS stats';
      if (!isPositiveIntLike(body.team_id)) return 'Team is required for VIS stats';
    }

    if (body.score_home !== undefined && Number.isNaN(Number(body.score_home))) return 'Home score must be numeric';
    if (body.score_away !== undefined && Number.isNaN(Number(body.score_away))) return 'Away score must be numeric';
    return null;
  },
};

function validateRequest(schemaName) {
  return (req, res, next) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const validate = validators[schemaName];
    if (!validate) {
      return res.status(500).json({ error: 'Validation schema is not configured' });
    }

    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    return next();
  };
}

module.exports = validateRequest;
