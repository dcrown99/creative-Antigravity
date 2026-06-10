import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.analyst import AIAnalyst


@pytest.fixture
def analyst():
    """AIAnalyst instance fixture"""
    return AIAnalyst()


@pytest.fixture
def sample_portfolio():
    """Sample portfolio data"""
    return [
        {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "quantity": 10,
            "avgCost": 150.0,
            "currentPrice": 175.0,
            "currency": "USD"
        }
    ]


@pytest.fixture
def sample_news():
    """Sample news articles"""
    return [
        {
            "title": "Apple announces new product line",
            "link": "https://example.com/apple-news",
            "published": "2024-01-01"
        }
    ]


@patch('src.analyst.genai.GenerativeModel')
def test_analyze_market_impact_success(
    mock_model_class,
    analyst,
    sample_portfolio,
    sample_news
):
    """Test analyze_market_impact with successful Gemini response"""
    # Mock Gemini response
    mock_model = MagicMock()
    mock_response = MagicMock()
    mock_response.text = """
    {
        "title": "Market Analysis - January 2024",
        "summary": "Apple股価上昇により、ポートフォリオは好調です",
        "script": "本日の市場分析をお伝えします。Appleの株価が上昇...",
        "sources": ["https://example.com/apple-news"]
    }
    """
    mock_model.generate_content.return_value = mock_response
    mock_model_class.return_value = mock_model

    result = analyst.analyze_market_impact(sample_portfolio, sample_news)

    assert "title" in result
    assert "summary" in result
    assert "script" in result
    assert "sources" in result
    assert result["title"] == "Market Analysis - January 2024"


@patch('src.analyst.genai.GenerativeModel')
def test_analyze_market_impact_with_empty_news(
    mock_model_class,
    analyst,
    sample_portfolio
):
    """Test analyze_market_impact with no news articles"""
    mock_model = MagicMock()
    mock_response = MagicMock()
    mock_response.text = """
    {
        "title": "Market Analysis",
        "summary": "ニュースはありませんが、ポートフォリオは安定しています",
        "script": "本日はニュースがありませんが...",
        "sources": []
    }
    """
    mock_model.generate_content.return_value = mock_response
    mock_model_class.return_value = mock_model

    result = analyst.analyze_market_impact(sample_portfolio, [])

    assert "title" in result
    assert result["sources"] == []


@patch('src.analyst.genai.GenerativeModel')
def test_analyze_market_impact_gemini_error(
    mock_model_class,
    analyst,
    sample_portfolio,
    sample_news
):
    """Test analyze_market_impact handles Gemini API errors"""
    mock_model = MagicMock()
    mock_model.generate_content.side_effect = Exception("Gemini API error")
    mock_model_class.return_value = mock_model

    result = analyst.analyze_market_impact(sample_portfolio, sample_news)

    # Should return error response
    assert "error" in result or "title" in result


@patch('src.analyst.genai.GenerativeModel')
def test_analyze_market_impact_invalid_json(
    mock_model_class,
    analyst,
    sample_portfolio,
    sample_news
):
    """Test analyze_market_impact handles invalid JSON response"""
    mock_model = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Invalid JSON response"
    mock_model.generate_content.return_value = mock_response
    mock_model_class.return_value = mock_model

    result = analyst.analyze_market_impact(sample_portfolio, sample_news)

    # Should handle gracefully
    assert isinstance(result, dict)


def test_analyst_initialization():
    """Test AIAnalyst can be initialized"""
    analyst = AIAnalyst()
    assert analyst is not None
