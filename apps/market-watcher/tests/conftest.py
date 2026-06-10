import os
import sys

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.main import app


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def mock_portfolio_data():
    """Mock portfolio data"""
    return [
        {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "quantity": 10,
            "avgCost": 150.0,
            "currentPrice": 175.0,
            "currency": "USD"
        },
        {
            "ticker": "GOOGL",
            "name": "Alphabet Inc.",
            "quantity": 5,
            "avgCost": 2500.0,
            "currentPrice": 2700.0,
            "currency": "USD"
        }
    ]


@pytest.fixture
def mock_news_list():
    """Mock news articles"""
    return [
        {
            "title": "Tech stocks surge on AI news",
            "link": "https://example.com/news1",
            "published": "2024-01-01"
        },
        {
            "title": "Market update: Strong earnings",
            "link": "https://example.com/news2",
            "published": "2024-01-01"
        }
    ]


@pytest.fixture
def mock_gemini_response():
    """Mock Gemini API response"""
    return {
        "title": "Market Analysis - January 2024",
        "summary": "Strong performance across tech sector",
        "script": "Today's market shows positive trends...",
        "sources": ["https://example.com/news1"]
    }


@pytest.fixture
def mock_voicevox_audio():
    """Mock Voicevox audio response"""
    return b"fake_audio_data"
