> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Contributing Overview

> Contribute to the cognee project

We welcome contributions from the community! Your input helps make Cognee better for everyone.
This page outlines instructions and best practices for contributing to Cognee, ensuring your contributions are integrated into the project efficiently.

## How To Contribute

There are many ways in which you can contribute to this project include: submitting bug reports and feature requests via GitHub [issues](https://github.com/topoteretes/cognee/issues),
opening PRs with features, fixes, or tests, reviewing others’ PRs, and collaborating by commenting or answering questions in the [Discord community](https://discord.com/invite/m63hxKsp4p).

### Development Setup

Firstly, you will need to set up your local copy of the cognee code repository. Keep in mind that we have two different
repositories: our [core repo](https://github.com/topoteretes/cognee), which contains core cognee functionalities,
and our [community repo](https://github.com/topoteretes/cognee-community), which contains community-maintained add-ons and custom packages.

Once you have chosen the repo you are going to work on, you have to fork it, and clone it to your machine:

```bash  theme={null}
git clone https://github.com/<your-github-username>/cognee.git
cd cognee
# OR
git clone https://github.com/<your-github-username>/cognee-community.git
cd cognee-community
```

After this, just create a branch for your work, and add your code there:

```bash  theme={null}
git checkout -b feature/your-feature-name
```

### Development Guidelines

While working on new features and fixes, make sure to keep these guidelines in mind:

* **Code Style** - Make sure to follow the [PEP8](https://peps.python.org/pep-0008/) style guide, and also the style of the project codebase.
  Reuse as much of the code as possible, and follow the existing package and file hierarchy.
* **Tests** - Make sure to add tests for new features, and that the tests pass before opening a PR
* **Commits** - Write clear and concise commit messages

#### Linting and Formatting

Before creating a Pull Request, you need to make sure that your code is linted and formatted correctly.
To do this, you first have to install [ruff](https://docs.astral.sh/ruff/) on your system.
Ruff is part of the default dependencies, so you can install it via `poetry` in the root of the
project, or through `pip`.

```bash  theme={null}
poetry install
# OR
pip install ruff
```

#### Submitting a Pull Request

After successfully linting and formatting your code, you can push your changes:

```bash  theme={null}
git add .
git commit -s -m "Description of your changes"
git push origin feature/your-feature-name
```

And now, create a Pull Request so your contribution can be reviewed, and eventually merged to the project repository:

* Go to the repository you made changes for (i.e. the core repo or the community repo)
* Click **Compare & Pull Request** and open a PR, being careful against **which branch**
  you open it (`dev` for core repo, `main` for community)
* Fill in the PR template with details about your changes

After opening the PR, we will make sure to review it, and eventually your contribution will be a part of the Cognee project!

<CardGroup cols={3}>
  <Card title="Contributing Guide Details" href="https://github.com/topoteretes/cognee/blob/main/CONTRIBUTING.md" icon="book">
    More details about the contributing process.
  </Card>

  <Card title="Community Guidelines" href="https://github.com/topoteretes/cognee/blob/main/CODE_OF_CONDUCT.md" icon="book">
    Be respectful and follow our code of conduct. Help others learn and grow, and provide constructive feedback.
  </Card>

  <Card title="Join our Discord Community" href="https://discord.gg/m63hxKsp4p" icon="discord">
    Join the community for real-time discussions with us and other users!
  </Card>
</CardGroup>
