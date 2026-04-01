import os

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

pytest_plugins = ["e2e.steps.common_steps"]


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--base-url",
        action="store",
        default=os.environ.get("E2E_BASE_URL", "http://localhost:3000"),
        help="Base URL for the app under test (default: http://localhost:3000)",
    )
    parser.addoption(
        "--headed",
        action="store_true",
        default=False,
        help="Run browser with a visible UI (default: headless)",
    )


@pytest.fixture(scope="session")
def base_url(pytestconfig: pytest.Config) -> str:
    return str(pytestconfig.getoption("--base-url")).rstrip("/")


@pytest.fixture()
def driver(pytestconfig: pytest.Config):
    headed = bool(pytestconfig.getoption("--headed"))

    options = Options()
    if not headed:
        options.add_argument("--headless=new")

    options.add_argument("--window-size=1280,900")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--lang=en-US")

    web_driver = webdriver.Chrome(options=options)
    web_driver.implicitly_wait(2)

    try:
        yield web_driver
    finally:
        web_driver.quit()
