#!/usr/bin/env node

const QARunner = require('./qa_runner');
const QAEvaluator = require('./qa_evaluator');
const QAReport = require('./qa_report');

async function main() {
  console.log('🚀 QA EVALUATOR - CHATBOT IES LANUZA');
  console.log('=====================================\n');

  try {
    const runner = new QARunner();
    const evaluator = new QAEvaluator();
    const reporter = new QAReport();

    console.log('🔄 Running test suite...\n');
    const testResults = await runner.runAllTests();

    console.log('📊 Evaluating results...\n');
    const evaluationResults = evaluator.evaluateAllTests(testResults);

    console.log('📋 Generating report...\n');
    const report = reporter.generateReport(evaluationResults);

    console.log(report);
    console.log('\n');

    reporter.saveReportToFile(report, `qa-report-${new Date().toISOString().split('T')[0]}.txt`);

    const finalScore = evaluationResults.individualEvaluations.length > 0 
      ? Math.round(evaluationResults.individualEvaluations.reduce((sum, e) => sum + e.final_score, 0) / evaluationResults.individualEvaluations.length)
      : 0;

    if (finalScore >= 80) {
      console.log('✅ QA PASSED - System ready for production');
      process.exit(0);
    } else if (finalScore >= 60) {
      console.log('⚠️  QA WARNING - System needs improvements before production');
      process.exit(1);
    } else {
      console.log('❌ QA FAILED - System not ready for production');
      process.exit(2);
    }

  } catch (error) {
    console.error('❌ QA System Error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(3);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
