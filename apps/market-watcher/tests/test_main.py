from unittest.mock import patch


def test_root_endpoint(client):
    """Test root endpoint returns OK status"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@patch('src.main.portfolio_reader.read')
@patch('src.main.news_collector.fetch_latest')
@patch('src.main.analyst.analyze_market_impact')
def test_analyze_daily_success(
    mock_analyze,
    mock_news,
    mock_portfolio,
    client,
    mock_portfolio_data,
    mock_news_list,
    mock_gemini_response
):
    """Test POST /analyze/daily with successful analysis"""
    mock_portfolio.return_value = mock_portfolio_data
    mock_news.return_value = mock_news_list
    mock_analyze.return_value = mock_gemini_response

    response = client.post("/analyze/daily")

    assert response.status_code == 200
    data = response.json()

    assert data["title"] == mock_gemini_response["title"]
    assert data["summary"] == mock_gemini_response["summary"]
    assert data["script"] == mock_gemini_response["script"]

    # Verify functions were called
    mock_portfolio.assert_called_once()
    mock_news.assert_called_once()
    mock_analyze.assert_called_once_with(mock_portfolio_data, mock_news_list)


@patch('src.main.portfolio_reader.read')
def test_analyze_daily_portfolio_not_found(mock_portfolio, client):
    """Test POST /analyze/daily when portfolio file not found"""
    mock_portfolio.side_effect = FileNotFoundError("Portfolio not found")

    response = client.post("/analyze/daily")

    assert response.status_code == 404
    assert "Portfolio not found" in response.json()["detail"]


@patch('src.main.portfolio_reader.read')
@patch('src.main.news_collector.fetch_latest')
@patch('src.main.analyst.analyze_market_impact')
def test_analyze_daily_with_news_error(
    mock_analyze,
    mock_news,
    mock_portfolio,
    client,
    mock_portfolio_data,
    mock_gemini_response
):
    """Test POST /analyze/daily handles news fetching errors gracefully"""
    mock_portfolio.return_value = mock_portfolio_data
    mock_news.side_effect = Exception("News API error")
    mock_analyze.return_value = mock_gemini_response

    response = client.post("/analyze/daily")

    # Should still succeed with empty news list
    assert response.status_code == 200
    mock_analyze.assert_called_once_with(mock_portfolio_data, [])


@patch('src.main.portfolio_reader.read')
@patch('src.main.news_collector.fetch_latest')
@patch('src.main.analyst.analyze_market_impact')
@patch('src.main.tts.generate_audio')
def test_analyze_audio_success(
    mock_tts,
    mock_analyze,
    mock_news,
    mock_portfolio,
    client,
    mock_portfolio_data,
    mock_news_list,
    mock_gemini_response,
    mock_voicevox_audio
):
    """Test POST /analyze/audio generates audio successfully"""
    mock_portfolio.return_value = mock_portfolio_data
    mock_news.return_value = mock_news_list
    mock_analyze.return_value = mock_gemini_response
    mock_tts.return_value = mock_voicevox_audio

    response = client.post("/analyze/audio")

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.content == mock_voicevox_audio

    # Verify TTS was called with script
    mock_tts.assert_called_once_with(mock_gemini_response["script"])


@patch('src.main.portfolio_reader.read')
@patch('src.main.news_collector.fetch_latest')
@patch('src.main.analyst.analyze_market_impact')
def test_analyze_audio_no_script(
    mock_analyze,
    mock_news,
    mock_portfolio,
    client,
    mock_portfolio_data,
    mock_news_list
):
    """Test POST /analyze/audio fails when no script is generated"""
    mock_portfolio.return_value = mock_portfolio_data
    mock_news.return_value = mock_news_list
    mock_analyze.return_value = {"script": ""}  # Empty script

    response = client.post("/analyze/audio")

    assert response.status_code == 500
    assert "No script generated" in response.json()["detail"]


@patch('src.main.tts.generate_audio')
def test_generate_tts_success(mock_tts, client, mock_voicevox_audio):
    """Test POST /tts generates audio from text"""
    mock_tts.return_value = mock_voicevox_audio

    request_data = {"text": "こんにちは、市場分析です"}
    response = client.post("/tts", json=request_data)

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.content == mock_voicevox_audio

    mock_tts.assert_called_once_with(request_data["text"])


def test_generate_tts_empty_text(client):
    """Test POST /tts fails with empty text"""
    request_data = {"text": ""}
    response = client.post("/tts", json=request_data)

    assert response.status_code == 400
    assert "Text is required" in response.json()["detail"]


@patch('src.main.tts.generate_audio')
def test_generate_tts_failure(mock_tts, client):
    """Test POST /tts handles TTS generation failure"""
    mock_tts.return_value = None  # Simulate failure

    request_data = {"text": "テストテキスト"}
    response = client.post("/tts", json=request_data)

    assert response.status_code == 500
    assert "Failed to generate audio" in response.json()["detail"]
