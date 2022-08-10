pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                container('node') {
                    sh 'ci/build.sh'
                }
            }
        }
        stage('Test') {
            steps {
                echo 'Testing..'
            }
        }
        stage('Deploy') {
            steps {
                echo 'Deploying....'
            }
        }
    }
}
