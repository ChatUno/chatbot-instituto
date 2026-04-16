class QAReport {
  generateReport(evaluationResults) {
    const { individualEvaluations } = evaluationResults;
    
    const totalTests = individualEvaluations.length;
    const avgScores = this.calculateAverageScores(individualEvaluations);
    const finalScore = this.calculateFinalScore(avgScores);
    const criticalIssues = this.findCriticalIssues(individualEvaluations);
    const inconsistencies = this.findInconsistencies(individualEvaluations);
    const categoryBreakdown = this.getCategoryBreakdown(individualEvaluations);

    const report = [];
    
    report.push('📊 QA REPORT - CHATBOT IES LANUZA');
    report.push('');
    report.push(`FINAL SCORE: ${finalScore}/100`);
    report.push('');
    report.push('📈 CATEGORY SCORES:');
    report.push(`✔ Correctness: ${avgScores.correctness}`);
    report.push(`✔ Retrieval: ${avgScores.retrieval}`);
    report.push(`✔ Anti-hallucination: ${avgScores.hallucination}`);
    report.push(`✔ Consistency: ${avgScores.consistency}`);
    report.push(`✔ Robustness: ${avgScores.robustness}`);
    report.push(`✔ Latency: ${avgScores.latency}`);
    report.push('');

    if (categoryBreakdown.length > 0) {
      report.push('📋 PERFORMANCE BY CATEGORY:');
      categoryBreakdown.forEach(category => {
        report.push(`  ${category.name}: ${category.avgScore}/100 (${category.count} tests)`);
      });
      report.push('');
    }

    if (criticalIssues.length > 0) {
      report.push('❌ CRITICAL ISSUES:');
      criticalIssues.forEach(issue => {
        report.push(`  • ${issue}`);
      });
      report.push('');
    }

    if (inconsistencies.length > 0) {
      report.push('⚠️  INCONSISTENCIES:');
      inconsistencies.forEach(inconsistency => {
        report.push(`  • ${inconsistency}`);
      });
      report.push('');
    }

    report.push(`📊 TEST SUMMARY:`);
    report.push(`  Total Tests: ${totalTests}`);
    report.push(`  Passed: ${individualEvaluations.filter(e => e.final_score >= 70).length}`);
    report.push(`  Failed: ${individualEvaluations.filter(e => e.final_score < 70).length}`);
    report.push(`  Average Latency: ${Math.round(individualEvaluations.reduce((sum, e) => sum + e.latency, 0) / totalTests)}ms`);
    report.push('');

    const worstTests = individualEvaluations
      .filter(e => e.final_score < 50)
      .sort((a, b) => a.final_score - b.final_score)
      .slice(0, 5);

    if (worstTests.length > 0) {
      report.push('🔍 WORST PERFORMING TESTS:');
      worstTests.forEach(test => {
        report.push(`  • ${test.testId}: ${test.final_score}/100`);
        report.push(`    Message: "${test.message.substring(0, 50)}..."`);
        report.push(`    Issue: ${this.getMainIssue(test)}`);
      });
      report.push('');
    }

    const bestTests = individualEvaluations
      .filter(e => e.final_score >= 90)
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 3);

    if (bestTests.length > 0) {
      report.push('🌟 BEST PERFORMING TESTS:');
      bestTests.forEach(test => {
        report.push(`  • ${test.testId}: ${test.final_score}/100`);
        report.push(`    Message: "${test.message.substring(0, 50)}..."`);
      });
      report.push('');
    }

    report.push('🎯 RECOMMENDATIONS:');
    report.push(...this.generateRecommendations(avgScores, criticalIssues, inconsistencies));
    report.push('');

    const status = finalScore >= 80 ? '✅ PRODUCTION READY' : 
                  finalScore >= 60 ? '⚠️  NEEDS IMPROVEMENT' : 
                  '❌ NOT READY FOR PRODUCTION';
    
    report.push(`🚀 DEPLOYMENT STATUS: ${status}`);

    return report.join('\n');
  }

  calculateAverageScores(evaluations) {
    const scores = evaluations.reduce((acc, evaluation) => {
      Object.keys(evaluation.scores).forEach(key => {
        if (!acc[key]) acc[key] = [];
        acc[key].push(evaluation.scores[key]);
      });
      return acc;
    }, {});

    const averages = {};
    Object.keys(scores).forEach(key => {
      const sum = scores[key].reduce((a, b) => a + b, 0);
      averages[key] = Math.round(sum / scores[key].length);
    });

    return averages;
  }

  calculateFinalScore(avgScores) {
    const weights = {
      correctness: 0.25,
      retrieval: 0.20,
      hallucination: 0.20,
      consistency: 0.15,
      robustness: 0.10,
      latency: 0.10
    };

    const finalScore = Object.keys(weights).reduce((sum, key) => {
      return sum + (avgScores[key] || 0) * weights[key];
    }, 0);

    return Math.round(finalScore);
  }

  findCriticalIssues(evaluations) {
    const issues = [];

    const failedTests = evaluations.filter(e => e.final_score < 50);
    if (failedTests.length > 0) {
      issues.push(`${failedTests.length} tests with critical failures (<50 score)`);
    }

    const highLatencyTests = evaluations.filter(e => e.latency > 3000);
    if (highLatencyTests.length > 0) {
      issues.push(`${highLatencyTests.length} tests with very high latency (>3s)`);
    }

    const lowCorrectness = evaluations.filter(e => e.scores.correctness < 60);
    if (lowCorrectness.length > 0) {
      issues.push(`${lowCorrectness.length} tests with poor correctness (<60)`);
    }

    const hallucinationIssues = evaluations.filter(e => e.scores.hallucination < 50);
    if (hallucinationIssues.length > 0) {
      issues.push(`${hallucinationIssues.length} tests with potential hallucination issues`);
    }

    const failedRequests = evaluations.filter(e => !e.success);
    if (failedRequests.length > 0) {
      issues.push(`${failedRequests.length} failed HTTP requests`);
    }

    return issues;
  }

  findInconsistencies(evaluations) {
    const inconsistencies = [];
    const groupedTests = {};

    evaluations.forEach(evaluation => {
      const messageKey = evaluation.message.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!groupedTests[messageKey]) {
        groupedTests[messageKey] = [];
      }
      groupedTests[messageKey].push(evaluation);
    });

    Object.entries(groupedTests).forEach(([message, tests]) => {
      if (tests.length > 1) {
        const scores = tests.map(t => t.final_score);
        const variance = Math.max(...scores) - Math.min(...scores);
        
        if (variance > 30) {
          inconsistencies.push(
            `High score variance (${variance} points) for: "${message.substring(0, 40)}..."`
          );
        }

        const latencies = tests.map(t => t.latency);
        const latencyVariance = Math.max(...latencies) - Math.min(...latencies);
        
        if (latencyVariance > 2000) {
          inconsistencies.push(
            `High latency variance (${latencyVariance}ms) for: "${message.substring(0, 40)}..."`
          );
        }
      }
    });

    return inconsistencies;
  }

  getCategoryBreakdown(evaluations) {
    const categories = {};

    evaluations.forEach(evaluation => {
      let category = 'unknown';
      if (evaluation.testId.includes('greeting')) category = 'greetings';
      else if (evaluation.testId.includes('bachillerato') || evaluation.testId.includes('fp') || evaluation.testId.includes('subjects')) category = 'academic';
      else if (evaluation.testId.includes('location') || evaluation.testId.includes('phone') || evaluation.testId.includes('center') || evaluation.testId.includes('schedule')) category = 'information';
      else if (evaluation.testId.includes('spam') || evaluation.testId.includes('edge') || evaluation.testId.includes('race')) category = 'robustness';

      if (!categories[category]) {
        categories[category] = { scores: [], count: 0 };
      }
      categories[category].scores.push(evaluation.final_score);
      categories[category].count++;
    });

    return Object.entries(categories).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      count: data.count
    })).sort((a, b) => b.avgScore - a.avgScore);
  }

  getMainIssue(testResult) {
    const issues = [];

    if (testResult.scores.correctness < 50) issues.push('Low correctness');
    if (testResult.scores.hallucination < 50) issues.push('Potential hallucination');
    if (testResult.scores.latency < 50) issues.push('High latency');
    if (!testResult.success) issues.push('Request failed');

    return issues.length > 0 ? issues.join(', ') : 'Minor issues';
  }

  generateRecommendations(avgScores, criticalIssues, inconsistencies) {
    const recommendations = [];

    if (avgScores.correctness < 70) {
      recommendations.push('• Improve response accuracy and relevance');
    }

    if (avgScores.latency < 70) {
      recommendations.push('• Optimize response time (target <800ms)');
    }

    if (avgScores.hallucination < 70) {
      recommendations.push('• Add better fact-checking and validation');
    }

    if (avgScores.robustness < 70) {
      recommendations.push('• Enhance error handling for edge cases');
    }

    if (inconsistencies.length > 0) {
      recommendations.push('• Improve response consistency across similar inputs');
    }

    if (criticalIssues.length > 3) {
      recommendations.push('• Address critical issues before production deployment');
    }

    if (recommendations.length === 0) {
      recommendations.push('• System performing well - consider monitoring in production');
    }

    return recommendations;
  }

  saveReportToFile(report, filename = 'qa-report.txt') {
    const fs = require('fs');
    const path = require('path');
    
    const reportPath = path.join(__dirname, '..', 'logs', filename);
    
    try {
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`📄 Report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`❌ Failed to save report: ${error.message}`);
    }
  }
}

module.exports = QAReport;
