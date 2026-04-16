const testCases = [
  {
    id: 'greeting_1',
    category: 'basic',
    message: 'hola',
    expected_keywords: ['hola', 'asistente', 'juan de lanuza', 'ayudarte'],
    expected_response_type: 'greeting'
  },
  {
    id: 'bachillerato_1',
    category: 'academic',
    message: 'qué bachilleratos hay',
    expected_keywords: ['bachilleratos', 'ciencias', 'tecnología', 'humanidades', 'ciencias sociales'],
    expected_response_type: 'academic_info'
  },
  {
    id: 'fp_1',
    category: 'academic',
    message: 'qué fp hay',
    expected_keywords: ['no dispongo', 'información'],
    expected_response_type: 'academic_info'
  },
  {
    id: 'location_1',
    category: 'info',
    message: 'dónde está el instituto',
    expected_keywords: ['instituto', 'juan de lanuza', 'calle capuchinos', 'borja', 'zaragoza'],
    expected_response_type: 'location_info'
  },
  {
    id: 'phone_1',
    category: 'info',
    message: 'teléfono del instituto',
    expected_keywords: ['teléfono', 'contacto', '976', 'juan de lanuza'],
    expected_response_type: 'contact_info'
  },
  {
    id: 'subjects_1',
    category: 'academic',
    message: 'qué asignaturas hay',
    expected_keywords: ['asignaturas', 'programación', 'robótica', 'física', 'química', 'biología'],
    expected_response_type: 'academic_info'
  },
  {
    id: 'bachiller_content_1',
    category: 'academic',
    message: 'qué estudias en bachiller',
    expected_keywords: ['bachilleratos', 'ciencias', 'tecnología', 'humanidades', 'ciencias sociales'],
    expected_response_type: 'academic_info'
  },
  {
    id: 'center_info_1',
    category: 'info',
    message: 'qué es el centro',
    expected_keywords: ['centro', 'instituto', 'juan de lanuza', 'educativo', 'secundaria'],
    expected_response_type: 'center_info'
  },
  {
    id: 'schedule_1',
    category: 'info',
    message: 'horarios',
    expected_keywords: ['no dispongo', 'información'],
    expected_response_type: 'schedule_info'
  },
  {
    id: 'edge_case_empty',
    category: 'robustness',
    message: '',
    expected_keywords: [],
    expected_response_type: 'error_handling'
  },
  {
    id: 'edge_case_special_chars',
    category: 'robustness',
    message: '¿¡ñáéíóú!@#$%',
    expected_keywords: [],
    expected_response_type: 'error_handling'
  },
  {
    id: 'edge_case_very_long',
    category: 'robustness',
    message: 'hola '.repeat(100),
    expected_keywords: [],
    expected_response_type: 'robustness'
  }
];

const spamTest = {
  id: 'spam_test',
  category: 'robustness',
  message: 'hola',
  repeat_count: 20,
  concurrent: true,
  expected_response_type: 'robustness'
};

module.exports = {
  testCases,
  spamTest
};
