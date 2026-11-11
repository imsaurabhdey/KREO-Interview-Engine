/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Universal Skills & Conceptual Competencies Knowledge Base.
 * Covers systems programming, concurrency, low latency, distributed architecture,
 * cloud, data engineering, AI/ML, languages, security, and enterprise methodologies.
 */

export interface UniversalSkill {
  name: string;
  category: string;
  related: string[];
  aliases?: string[];
}

export const UNIVERSAL_SKILLS_DATABASE: UniversalSkill[] = [
  // ==========================================
  // SYSTEMS, CONCURRENCY & LOW LATENCY
  // ==========================================
  {
    name: 'Concurrency',
    category: 'Systems & Performance',
    related: ['Multithreading', 'Low Latency', 'Thread Safety', 'Parallel Programming', 'Asynchronous Programming', 'Race Conditions', 'Mutex & Locks', 'Java Concurrency', 'Go Goroutines'],
    aliases: ['concurrent programming', 'concurrency control', 'concurrent systems']
  },
  {
    name: 'Low Latency',
    category: 'Systems & Performance',
    related: ['High Throughput', 'Concurrency', 'Zero-Copy I/O', 'Lock-Free Data Structures', 'DPDK', 'Memory Alignment', 'Cache Coherence', 'Kernel Bypass'],
    aliases: ['low-latency systems', 'ultra low latency', 'sub-millisecond latency']
  },
  {
    name: 'Multithreading',
    category: 'Systems & Performance',
    related: ['Concurrency', 'Thread Pools', 'Thread Safety', 'Deadlock Detection', 'Atomic Operations', 'Java Memory Model', 'Posix Threads (pthreads)'],
    aliases: ['multi-threaded programming', 'threads', 'thread management']
  },
  {
    name: 'Parallel Programming',
    category: 'Systems & Performance',
    related: ['Concurrency', 'SIMD', 'OpenMP', 'MPI', 'GPU Computing', 'CUDA', 'Distributed Computing'],
    aliases: ['parallel computing', 'parallel processing']
  },
  {
    name: 'Thread Safety',
    category: 'Systems & Performance',
    related: ['Concurrency', 'Multithreading', 'Atomic Operations', 'Immutable Data', 'Synchronization', 'Volatile Keyword'],
    aliases: ['thread-safe design', 'reentrant code']
  },
  {
    name: 'Lock-Free Data Structures',
    category: 'Systems & Performance',
    related: ['Compare-And-Swap (CAS)', 'Concurrency', 'Low Latency', 'Atomic Operations', 'Ring Buffers', 'Disruptor Pattern'],
    aliases: ['lock free', 'wait-free algorithms', 'non-blocking algorithms']
  },
  {
    name: 'High Throughput',
    category: 'Systems & Performance',
    related: ['Low Latency', 'Batching', 'Zero-Copy I/O', 'Pipelining', 'Event-Driven Architecture', 'Kafka'],
    aliases: ['high throughput systems', 'throughput optimization']
  },
  {
    name: 'Memory Management',
    category: 'Systems & Performance',
    related: ['Garbage Collection Tuning', 'Heap Profiling', 'Memory Leaks', 'Off-Heap Memory', 'Zero-Allocation', 'C/C++ Pointers'],
    aliases: ['memory optimization', 'memory tuning', 'gc tuning']
  },
  {
    name: 'Garbage Collection Tuning',
    category: 'Systems & Performance',
    related: ['JVM Profiling', 'G1GC', 'ZGC', 'Shenandoah', 'Memory Management', 'Stop-The-World Pauses'],
    aliases: ['gc tuning', 'jvm garbage collection', 'memory profiling']
  },
  {
    name: 'Asynchronous Programming',
    category: 'Systems & Performance',
    related: ['Event Loop', 'Promises', 'Async/Await', 'Reactive Streams', 'Coroutines', 'Non-Blocking I/O'],
    aliases: ['async/await', 'async io', 'asynchronous io']
  },
  {
    name: 'Socket Programming',
    category: 'Networking & Systems',
    related: ['TCP/IP', 'UDP', 'Network I/O', 'WebSockets', 'epoll / kqueue', 'Netty'],
    aliases: ['network sockets', 'bsd sockets', 'raw sockets']
  },
  {
    name: 'Zero-Copy I/O',
    category: 'Systems & Performance',
    related: ['Low Latency', 'High Throughput', 'Direct Memory', 'sendFile', 'Memory Mapped Files (mmap)', 'Kafka'],
    aliases: ['zero-copy', 'direct memory access']
  },
  {
    name: 'Linux Internals',
    category: 'Systems & Performance',
    related: ['Kernel Tuning', 'eBPF', 'System Calls', 'IPC', 'epoll', 'cgroups', 'Virtual Memory'],
    aliases: ['linux kernel', 'os internals', 'posix']
  },
  {
    name: 'eBPF',
    category: 'Systems & Performance',
    related: ['Linux Internals', 'Observability', 'Kernel Tracing', 'Network Filtering', 'BCC'],
    aliases: ['extended bpf', 'bpf']
  },

  // ==========================================
  // DISTRIBUTED SYSTEMS & ARCHITECTURE
  // ==========================================
  {
    name: 'Distributed Systems',
    category: 'Architecture',
    related: ['CAP Theorem', 'Consensus Algorithms', 'Microservices', 'Event-Driven Architecture', 'Sharding', 'Replication', 'Distributed Locking'],
    aliases: ['distributed computing', 'distributed architecture']
  },
  {
    name: 'Microservices',
    category: 'Architecture',
    related: ['Docker', 'Kubernetes', 'API Gateway', 'gRPC', 'Service Mesh', 'RESTful APIs', 'Domain-Driven Design'],
    aliases: ['microservice architecture', 'micro-services']
  },
  {
    name: 'System Design',
    category: 'Architecture',
    related: ['Scalability', 'High Availability', 'Load Balancing', 'Caching', 'Fault Tolerance', 'Database Sharding'],
    aliases: ['software architecture', 'large-scale systems']
  },
  {
    name: 'Event-Driven Architecture',
    category: 'Architecture',
    related: ['Kafka', 'RabbitMQ', 'Event Sourcing', 'CQRS', 'Pub/Sub', 'Message Queues'],
    aliases: ['eda', 'event driven design']
  },
  {
    name: 'CQRS',
    category: 'Architecture',
    related: ['Event Sourcing', 'Domain-Driven Design', 'Kafka', 'Distributed Systems', 'Event-Driven Architecture'],
    aliases: ['command query responsibility segregation']
  },
  {
    name: 'Event Sourcing',
    category: 'Architecture',
    related: ['CQRS', 'Kafka', 'Audit Logs', 'State Machines', 'Domain-Driven Design'],
    aliases: ['event-sourced systems']
  },
  {
    name: 'Domain-Driven Design (DDD)',
    category: 'Architecture',
    related: ['Clean Architecture', 'Microservices', 'Ubiquitous Language', 'Bounded Contexts', 'Aggregates'],
    aliases: ['ddd', 'domain driven design']
  },
  {
    name: 'gRPC',
    category: 'Architecture',
    related: ['Protocol Buffers (Protobuf)', 'HTTP/2', 'Microservices', 'High Performance APIs', 'RPC'],
    aliases: ['grpc services', 'protobuf']
  },
  {
    name: 'Protocol Buffers (Protobuf)',
    category: 'Architecture',
    related: ['gRPC', 'Binary Serialization', 'Data Serialization', 'Microservices'],
    aliases: ['protobuf', 'proto3']
  },
  {
    name: 'WebSockets',
    category: 'Architecture',
    related: ['Real-Time Systems', 'Socket.IO', 'Server-Sent Events (SSE)', 'WebRTC', 'Full-Duplex'],
    aliases: ['websocket protocol', 'realtime communication']
  },
  {
    name: 'Service Mesh',
    category: 'Architecture',
    related: ['Istio', 'Envoy Proxy', 'Linkerd', 'Microservices', 'mTLS', 'Traffic Management'],
    aliases: ['service mesh architecture', 'istio']
  },
  {
    name: 'API Gateway',
    category: 'Architecture',
    related: ['Kong', 'Apigee', 'AWS API Gateway', 'Rate Limiting', 'Authentication', 'Reverse Proxy'],
    aliases: ['api management', 'gateway routing']
  },
  {
    name: 'Distributed Caching',
    category: 'Architecture',
    related: ['Redis', 'Memcached', 'Cache Invalidation', 'Cache-Aside', 'Write-Through', 'CDN'],
    aliases: ['caching strategies', 'redis caching']
  },
  {
    name: 'Distributed Locking',
    category: 'Architecture',
    related: ['Redlock', 'Zookeeper', 'Consensus Algorithms', 'Concurrency', 'Distributed Systems'],
    aliases: ['distributed locks', 'distributed mutex']
  },
  {
    name: 'Consensus Algorithms',
    category: 'Architecture',
    related: ['Raft', 'Paxos', 'Etcd', 'Zookeeper', 'Distributed Systems', 'Leader Election'],
    aliases: ['raft consensus', 'paxos protocol']
  },

  // ==========================================
  // PROGRAMMING LANGUAGES
  // ==========================================
  {
    name: 'Java',
    category: 'Programming Languages',
    related: ['Spring Boot', 'JVM', 'Concurrency', 'Multithreading', 'Hibernate', 'Microservices', 'Kotlin'],
    aliases: ['core java', 'java 17', 'java 21', 'j2se', 'java se']
  },
  {
    name: 'Python',
    category: 'Programming Languages',
    related: ['FastAPI', 'Django', 'PySpark', 'Machine Learning', 'Data Science', 'Pandas', 'NumPy', 'Flask'],
    aliases: ['python3', 'python development']
  },
  {
    name: 'TypeScript',
    category: 'Programming Languages',
    related: ['JavaScript', 'React', 'Node.js', 'Next.js', 'Angular', 'Express.js', 'Frontend'],
    aliases: ['ts', 'typescript typing']
  },
  {
    name: 'JavaScript',
    category: 'Programming Languages',
    related: ['TypeScript', 'Node.js', 'React', 'HTML/CSS', 'Frontend', 'Async Programming'],
    aliases: ['js', 'es6', 'ecmascript']
  },
  {
    name: 'Go',
    category: 'Programming Languages',
    related: ['Golang', 'Goroutines', 'Concurrency', 'Docker', 'Kubernetes', 'Microservices', 'gRPC'],
    aliases: ['golang', 'go language']
  },
  {
    name: 'Rust',
    category: 'Programming Languages',
    related: ['Systems Programming', 'Memory Safety', 'Concurrency', 'Low Latency', 'WebAssembly', 'C++'],
    aliases: ['rustlang', 'cargo']
  },
  {
    name: 'C++',
    category: 'Programming Languages',
    related: ['C', 'Low Latency', 'Concurrency', 'Multithreading', 'STL', 'Systems Programming', 'Memory Management'],
    aliases: ['cpp', 'c++20', 'c++17', 'modern c++']
  },
  {
    name: 'C#',
    category: 'Programming Languages',
    related: ['.NET', 'ASP.NET Core', 'Entity Framework', 'LINQ', 'SQL Server', 'Microservices'],
    aliases: ['c sharp', 'c-sharp', 'dotnet c#']
  },
  {
    name: 'C',
    category: 'Programming Languages',
    related: ['C++', 'Embedded Systems', 'Pointers', 'Memory Management', 'Operating Systems', 'Linux Internals'],
    aliases: ['c programming', 'ansi c']
  },
  {
    name: 'Kotlin',
    category: 'Programming Languages',
    related: ['Android', 'Java', 'Coroutines', 'Spring Boot', 'Mobile Development'],
    aliases: ['kotlin/android', 'kotlin coroutines']
  },
  {
    name: 'Swift',
    category: 'Programming Languages',
    related: ['iOS', 'SwiftUI', 'Apple Platforms', 'Objective-C', 'Mobile Development'],
    aliases: ['swiftlang', 'swift 5']
  },
  {
    name: 'Scala',
    category: 'Programming Languages',
    related: ['Apache Spark', 'Functional Programming', 'Akka', 'JVM', 'Big Data'],
    aliases: ['scala programming']
  },
  {
    name: 'SQL',
    category: 'Databases & Querying',
    related: ['PostgreSQL', 'MySQL', 'SQL Server', 'Query Optimization', 'Indexing', 'Stored Procedures', 'Window Functions'],
    aliases: ['ansi sql', 'relational queries']
  },

  // ==========================================
  // BACKEND FRAMEWORKS & RUNTIMES
  // ==========================================
  {
    name: 'Spring Boot',
    category: 'Backend Frameworks',
    related: ['Java', 'Spring Security', 'Spring Data JPA', 'Microservices', 'Hibernate', 'RESTful APIs'],
    aliases: ['spring', 'spring framework', 'springboot']
  },
  {
    name: 'Spring Security',
    category: 'Backend Frameworks',
    related: ['Spring Boot', 'OAuth2', 'JWT', 'RBAC', 'Authentication', 'Java'],
    aliases: ['spring auth', 'spring-security']
  },
  {
    name: 'Spring Cloud',
    category: 'Backend Frameworks',
    related: ['Spring Boot', 'Microservices', 'Eureka', 'Config Server', 'OpenFeign', 'Resilience4j'],
    aliases: ['spring cloud microservices']
  },
  {
    name: 'Node.js',
    category: 'Backend Frameworks',
    related: ['Express.js', 'TypeScript', 'JavaScript', 'NestJS', 'Event Loop', 'RESTful APIs'],
    aliases: ['nodejs', 'node']
  },
  {
    name: 'Express.js',
    category: 'Backend Frameworks',
    related: ['Node.js', 'RESTful APIs', 'Middleware', 'TypeScript', 'JavaScript'],
    aliases: ['express', 'expressjs']
  },
  {
    name: 'NestJS',
    category: 'Backend Frameworks',
    related: ['Node.js', 'TypeScript', 'Dependency Injection', 'Microservices', 'GraphQL'],
    aliases: ['nest.js', 'nestjs framework']
  },
  {
    name: 'FastAPI',
    category: 'Backend Frameworks',
    related: ['Python', 'Pydantic', 'Asyncio', 'RESTful APIs', 'OpenAPI/Swagger', 'Machine Learning Serving'],
    aliases: ['fast api', 'fastapi framework']
  },
  {
    name: 'Django',
    category: 'Backend Frameworks',
    related: ['Python', 'Django REST Framework (DRF)', 'ORM', 'PostgreSQL', 'Fullstack'],
    aliases: ['django framework', 'drf']
  },
  {
    name: 'ASP.NET Core',
    category: 'Backend Frameworks',
    related: ['C#', '.NET', 'Web API', 'Entity Framework Core', 'Microservices'],
    aliases: ['aspnet', 'asp.net', 'dotnet core']
  },
  {
    name: 'GraphQL',
    category: 'Backend Frameworks',
    related: ['Apollo GraphQL', 'RESTful APIs', 'Schema Design', 'Resolvers', 'Node.js'],
    aliases: ['graphql api', 'apollo server']
  },
  {
    name: 'Netty',
    category: 'Backend Frameworks',
    related: ['Java', 'Asynchronous Programming', 'Socket Programming', 'Low Latency', 'Event-Driven Architecture', 'NIO'],
    aliases: ['netty framework', 'java nio']
  },

  // ==========================================
  // DATABASES & STORAGE
  // ==========================================
  {
    name: 'PostgreSQL',
    category: 'Databases & Storage',
    related: ['SQL', 'Query Optimization', 'Database Indexing', 'ACID Transactions', 'JSONB', 'TimescaleDB'],
    aliases: ['postgres', 'pgsql']
  },
  {
    name: 'MySQL',
    category: 'Databases & Storage',
    related: ['SQL', 'InnoDB', 'Replication', 'Query Optimization', 'Relational Databases'],
    aliases: ['mysql database', 'mariadb']
  },
  {
    name: 'MongoDB',
    category: 'Databases & Storage',
    related: ['NoSQL', 'Document Database', 'Mongoose', 'Aggregation Pipeline', 'Sharding'],
    aliases: ['mongo', 'mongodb database']
  },
  {
    name: 'Redis',
    category: 'Databases & Storage',
    related: ['Caching', 'Distributed Caching', 'Pub/Sub', 'In-Memory Storage', 'Data Structures', 'Low Latency'],
    aliases: ['redis cache', 'in-memory database']
  },
  {
    name: 'Elasticsearch',
    category: 'Databases & Storage',
    related: ['OpenSearch', 'Full-Text Search', 'Kibana', 'Logstash', 'ELK Stack', 'Inverted Index'],
    aliases: ['elastic search', 'elk']
  },
  {
    name: 'Apache Cassandra',
    category: 'Databases & Storage',
    related: ['NoSQL', 'Wide-Column Store', 'Distributed Databases', 'High Availability', 'ScyllaDB'],
    aliases: ['cassandra', 'cql']
  },
  {
    name: 'Database Indexing & Tuning',
    category: 'Databases & Storage',
    related: ['B-Trees', 'Query Execution Plan', 'Composite Indexes', 'Explain Analyze', 'PostgreSQL', 'MySQL'],
    aliases: ['query tuning', 'index optimization', 'sql performance']
  },
  {
    name: 'DynamoDB',
    category: 'Databases & Storage',
    related: ['AWS', 'NoSQL', 'Key-Value Store', 'Serverless', 'Single-Table Design'],
    aliases: ['amazon dynamodb', 'aws dynamodb']
  },
  {
    name: 'Snowflake',
    category: 'Databases & Storage',
    related: ['Data Warehousing', 'SQL', 'BigQuery', 'Cloud Data', 'ETL', 'Databricks'],
    aliases: ['snowflake data warehouse', 'snowflake cloud']
  },
  {
    name: 'ClickHouse',
    category: 'Databases & Storage',
    related: ['OLAP', 'Columnar Databases', 'Real-Time Analytics', 'SQL', 'High Throughput'],
    aliases: ['clickhouse db', 'columnar db']
  },

  // ==========================================
  // DATA ENGINEERING & MESSAGING
  // ==========================================
  {
    name: 'Apache Kafka',
    category: 'Data & Messaging',
    related: ['Event Streaming', 'Distributed Systems', 'Message Queues', 'Kafka Streams', 'Zookeeper / KRaft', 'High Throughput'],
    aliases: ['kafka', 'event streaming']
  },
  {
    name: 'PySpark',
    category: 'Data & Messaging',
    related: ['Apache Spark', 'Python', 'Big Data', 'Distributed Computing', 'DataFrames', 'Databricks'],
    aliases: ['pyspark dataframes', 'spark python']
  },
  {
    name: 'Apache Spark',
    category: 'Data & Messaging',
    related: ['PySpark', 'Scala', 'Big Data', 'RDDs', 'Databricks', 'Distributed Processing'],
    aliases: ['spark', 'spark streaming']
  },
  {
    name: 'RabbitMQ',
    category: 'Data & Messaging',
    related: ['AMQP', 'Message Queues', 'Event-Driven Architecture', 'Pub/Sub', 'Kafka'],
    aliases: ['rabbitmq messaging', 'message broker']
  },
  {
    name: 'ETL Pipelines',
    category: 'Data & Messaging',
    related: ['Data Engineering', 'Airflow', 'dbt', 'Informatica', 'Snowflake', 'Data Quality'],
    aliases: ['etl', 'elt', 'data pipelines', 'etl processing']
  },
  {
    name: 'Apache Airflow',
    category: 'Data & Messaging',
    related: ['Data Orchestration', 'DAGs', 'ETL Pipelines', 'Python', 'Cron', 'Prefect'],
    aliases: ['airflow', 'airflow dags']
  },
  {
    name: 'dbt (data build tool)',
    category: 'Data & Messaging',
    related: ['SQL', 'Data Modeling', 'Data Warehousing', 'Snowflake', 'BigQuery'],
    aliases: ['dbt', 'dbt core', 'dbt cloud']
  },
  {
    name: 'Databricks',
    category: 'Data & Messaging',
    related: ['Apache Spark', 'Delta Lake', 'PySpark', 'Machine Learning', 'Big Data'],
    aliases: ['databricks lakehouse', 'delta lake']
  },

  // ==========================================
  // CLOUD, DEVOPS & INFRASTRUCTURE
  // ==========================================
  {
    name: 'Docker',
    category: 'DevOps & Cloud',
    related: ['Kubernetes', 'Containers', 'Containerization', 'Dockerfile', 'CI/CD', 'Microservices'],
    aliases: ['containerization', 'docker containers']
  },
  {
    name: 'Kubernetes',
    category: 'DevOps & Cloud',
    related: ['Docker', 'Helm', 'Container Orchestration', 'Microservices', 'K8s', 'Cloud Native'],
    aliases: ['k8s', 'kubernetes clusters']
  },
  {
    name: 'AWS',
    category: 'DevOps & Cloud',
    related: ['EC2', 'S3', 'Lambda', 'ECS', 'EKS', 'CloudFormation', 'IAM', 'Cloud Computing'],
    aliases: ['amazon web services', 'aws cloud']
  },
  {
    name: 'GCP (Google Cloud)',
    category: 'DevOps & Cloud',
    related: ['Google Cloud Platform', 'GKE', 'Cloud Run', 'BigQuery', 'Cloud Functions', 'IAM'],
    aliases: ['google cloud', 'gcp', 'google cloud platform']
  },
  {
    name: 'Microsoft Azure',
    category: 'DevOps & Cloud',
    related: ['Azure DevOps', 'AKS', 'Azure Functions', 'Cosmos DB', 'Active Directory', 'Cloud'],
    aliases: ['azure', 'azure cloud']
  },
  {
    name: 'Terraform',
    category: 'DevOps & Cloud',
    related: ['Infrastructure as Code (IaC)', 'AWS', 'Kubernetes', 'Cloud Automation', 'HCL'],
    aliases: ['iac', 'terraform cloud']
  },
  {
    name: 'CI/CD Pipelines',
    category: 'DevOps & Cloud',
    related: ['GitHub Actions', 'Jenkins', 'GitLab CI', 'Docker', 'Automated Testing', 'Deployment'],
    aliases: ['ci/cd', 'continuous integration', 'continuous deployment']
  },
  {
    name: 'Prometheus & Grafana',
    category: 'DevOps & Cloud',
    related: ['Observability', 'Monitoring', 'Metrics', 'Alertmanager', 'OpenTelemetry', 'SRE'],
    aliases: ['prometheus', 'grafana', 'monitoring']
  },
  {
    name: 'OpenTelemetry',
    category: 'DevOps & Cloud',
    related: ['Distributed Tracing', 'Observability', 'Jaeger', 'Prometheus', 'Metrics', 'Logs'],
    aliases: ['otel', 'distributed tracing']
  },
  {
    name: 'Site Reliability Engineering (SRE)',
    category: 'DevOps & Cloud',
    related: ['SLOs / SLAs', 'Chaos Engineering', 'Incident Management', 'Monitoring', 'Automation'],
    aliases: ['sre', 'site reliability']
  },

  // ==========================================
  // ARTIFICIAL INTELLIGENCE & MACHINE LEARNING
  // ==========================================
  {
    name: 'Machine Learning',
    category: 'AI & Data Science',
    related: ['Deep Learning', 'Python', 'Scikit-Learn', 'Feature Engineering', 'Supervised Learning', 'Model Evaluation'],
    aliases: ['ml', 'machine learning algorithms']
  },
  {
    name: 'Deep Learning',
    category: 'AI & Data Science',
    related: ['PyTorch', 'TensorFlow', 'Neural Networks', 'CNN', 'RNN', 'Transformers'],
    aliases: ['deep learning models', 'neural nets']
  },
  {
    name: 'PyTorch',
    category: 'AI & Data Science',
    related: ['Deep Learning', 'Python', 'TensorFlow', 'Neural Networks', 'Model Training'],
    aliases: ['torch', 'pytorch framework']
  },
  {
    name: 'TensorFlow',
    category: 'AI & Data Science',
    related: ['Keras', 'Deep Learning', 'PyTorch', 'Python', 'Machine Learning'],
    aliases: ['tf', 'keras']
  },
  {
    name: 'Large Language Models (LLMs)',
    category: 'AI & Data Science',
    related: ['Prompt Engineering', 'RAG', 'LangChain', 'Fine-Tuning', 'Hugging Face', 'Embeddings'],
    aliases: ['llm', 'generative ai', 'genai', 'foundation models']
  },
  {
    name: 'Retrieval-Augmented Generation (RAG)',
    category: 'AI & Data Science',
    related: ['Vector Databases', 'Embeddings', 'LangChain', 'LlamaIndex', 'LLMs', 'Information Retrieval'],
    aliases: ['rag', 'vector search', 'semantic search']
  },
  {
    name: 'Vector Databases',
    category: 'AI & Data Science',
    related: ['Pinecone', 'Milvus', 'ChromaDB', 'Qdrant', 'RAG', 'Embeddings', 'Similarity Search'],
    aliases: ['vector db', 'vector search engine']
  },
  {
    name: 'Natural Language Processing (NLP)',
    category: 'AI & Data Science',
    related: ['Transformers', 'Tokenization', 'BERT', 'SpaCy', 'Sentiment Analysis', 'Text Classification'],
    aliases: ['nlp', 'computational linguistics']
  },
  {
    name: 'Computer Vision',
    category: 'AI & Data Science',
    related: ['OpenCV', 'Object Detection', 'YOLO', 'Image Segmentation', 'CNN', 'Deep Learning'],
    aliases: ['cv', 'vision ai', 'image processing']
  },

  // ==========================================
  // FRONTEND & MOBILE
  // ==========================================
  {
    name: 'React',
    category: 'Frontend & UI',
    related: ['Next.js', 'TypeScript', 'Redux', 'Hooks', 'Tailwind CSS', 'Frontend Performance'],
    aliases: ['reactjs', 'react.js']
  },
  {
    name: 'Next.js',
    category: 'Frontend & UI',
    related: ['React', 'Server-Side Rendering (SSR)', 'Static Site Generation (SSG)', 'TypeScript', 'Vercel'],
    aliases: ['nextjs', 'next.js app router']
  },
  {
    name: 'Vue.js',
    category: 'Frontend & UI',
    related: ['Nuxt.js', 'Pinia', 'Composition API', 'TypeScript', 'Frontend'],
    aliases: ['vue', 'vuejs', 'vue 3']
  },
  {
    name: 'Angular',
    category: 'Frontend & UI',
    related: ['TypeScript', 'RxJS', 'Dependency Injection', 'Directives', 'NgRx'],
    aliases: ['angular framework', 'angular 15+']
  },
  {
    name: 'Tailwind CSS',
    category: 'Frontend & UI',
    related: ['CSS3', 'Responsive Design', 'HTML/CSS', 'Design Systems', 'PostCSS'],
    aliases: ['tailwind', 'utility css']
  },
  {
    name: 'Web Performance Optimization',
    category: 'Frontend & UI',
    related: ['Core Web Vitals', 'Lighthouse', 'Code Splitting', 'Lazy Loading', 'Asset Optimization', 'CDN'],
    aliases: ['web performance', 'frontend performance', 'lighthouse tuning']
  },
  {
    name: 'React Native',
    category: 'Mobile Development',
    related: ['React', 'JavaScript', 'TypeScript', 'Mobile Apps', 'Expo', 'iOS & Android'],
    aliases: ['react-native', 'rn']
  },
  {
    name: 'Flutter',
    category: 'Mobile Development',
    related: ['Dart', 'Mobile Apps', 'Cross-Platform', 'Widgets', 'State Management'],
    aliases: ['flutter framework']
  },
  {
    name: 'Android Development',
    category: 'Mobile Development',
    related: ['Kotlin', 'Jetpack Compose', 'Android SDK', 'Coroutines', 'Gradle'],
    aliases: ['native android', 'android studio']
  },
  {
    name: 'iOS Development',
    category: 'Mobile Development',
    related: ['Swift', 'SwiftUI', 'UIKit', 'Xcode', 'CoreData'],
    aliases: ['native ios', 'ios apps']
  },

  // ==========================================
  // SECURITY & TESTING
  // ==========================================
  {
    name: 'Web Security & OWASP',
    category: 'Security & Compliance',
    related: ['OWASP Top 10', 'XSS Prevention', 'CSRF', 'SQL Injection', 'Content Security Policy (CSP)', 'Penetration Testing'],
    aliases: ['owasp', 'appsec', 'application security']
  },
  {
    name: 'OAuth 2.0 & OIDC',
    category: 'Security & Compliance',
    related: ['JWT', 'Single Sign-On (SSO)', 'SAML', 'Identity Management', 'API Security'],
    aliases: ['oauth2', 'openid connect', 'sso']
  },
  {
    name: 'Cryptography & Encryption',
    category: 'Security & Compliance',
    related: ['TLS/SSL', 'Public Key Infrastructure (PKI)', 'AES', 'RSA', 'Hashing', 'Data at Rest'],
    aliases: ['cryptography', 'data encryption']
  },
  {
    name: 'QA Automation',
    category: 'Testing & Quality',
    related: ['Selenium', 'Cypress', 'Playwright', 'Test Automation', 'Regression Testing', 'CI/CD'],
    aliases: ['automation testing', 'sdet', 'test automation']
  },
  {
    name: 'Selenium',
    category: 'Testing & Quality',
    related: ['QA Automation', 'WebDriver', 'Java', 'Python', 'Cross-Browser Testing'],
    aliases: ['selenium webdriver']
  },
  {
    name: 'Cypress',
    category: 'Testing & Quality',
    related: ['QA Automation', 'E2E Testing', 'JavaScript', 'Frontend Testing'],
    aliases: ['cypress testing', 'cypress.io']
  },
  {
    name: 'Playwright',
    category: 'Testing & Quality',
    related: ['QA Automation', 'E2E Testing', 'TypeScript', 'Cross-Browser Testing', 'API Testing'],
    aliases: ['playwright testing']
  },
  {
    name: 'Performance & Load Testing',
    category: 'Testing & Quality',
    related: ['JMeter', 'k6', 'Locust', 'Stress Testing', 'Latency Benchmarking', 'Scalability'],
    aliases: ['load testing', 'stress testing', 'jmeter']
  },
  {
    name: 'Unit Testing & TDD',
    category: 'Testing & Quality',
    related: ['Jest', 'Vitest', 'JUnit', 'Mockito', 'PyTest', 'Test-Driven Development', 'Code Coverage'],
    aliases: ['tdd', 'unit testing', 'test driven development']
  },

  // ==========================================
  // METHODOLOGY & LEADERSHIP
  // ==========================================
  {
    name: 'Algorithms & Data Structures',
    category: 'Core Competency',
    related: ['Problem Solving', 'Time & Space Complexity (Big-O)', 'Trees & Graphs', 'Dynamic Programming', 'Sorting'],
    aliases: ['dsa', 'data structures and algorithms']
  },
  {
    name: 'Agile & Scrum',
    category: 'Methodology & Leadership',
    related: ['Sprint Planning', 'Jira', 'Kanban', 'Standups', 'Retrospectives', 'Cross-Functional Teams'],
    aliases: ['agile methodologies', 'scrum master', 'agile']
  },
  {
    name: 'Technical Leadership & Mentorship',
    category: 'Methodology & Leadership',
    related: ['Code Reviews', 'Engineering Strategy', 'Team Mentorship', 'Architecture Governance', 'Stakeholder Communication'],
    aliases: ['tech lead', 'engineering leadership', 'team leadership']
  }
];

/**
 * Searches universal skills database by keyword, alias, category, and related terms.
 * If query has no direct match, always includes a dynamic candidate matching the query.
 */
export function searchUniversalSkills(query: string, limit: number = 8): UniversalSkill[] {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  const matched: { skill: UniversalSkill; score: number }[] = [];

  for (const item of UNIVERSAL_SKILLS_DATABASE) {
    const itemName = item.name.toLowerCase();
    let score = 0;

    if (itemName === cleanQ) {
      score = 100; // Exact match
    } else if (itemName.startsWith(cleanQ)) {
      score = 80; // Prefix match
    } else if (itemName.includes(cleanQ)) {
      score = 60; // Substring match
    } else if (item.aliases && item.aliases.some(a => a.toLowerCase().includes(cleanQ))) {
      score = 50; // Alias match
    } else if (item.related.some(r => r.toLowerCase().includes(cleanQ))) {
      score = 40; // Related match
    } else if (item.category.toLowerCase().includes(cleanQ)) {
      score = 30; // Category match
    }

    if (score > 0) {
      matched.push({ skill: item, score });
    }
  }

  // Sort by relevance score descending
  matched.sort((a, b) => b.score - a.score);
  const results = matched.slice(0, limit).map(m => m.skill);

  // If query is not an exact match to any returned skill, synthesize a custom skill entry
  const hasExact = results.some(r => r.name.toLowerCase() === cleanQ);
  if (!hasExact && cleanQ.length >= 2) {
    const formattedName = cleanQ
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const customEntry: UniversalSkill = {
      name: formattedName,
      category: 'Custom Target Skill',
      related: ['System Design', 'Performance Optimization', 'Architecture'],
      aliases: [cleanQ]
    };
    results.unshift(customEntry);
  }

  return results;
}

/**
 * Quick category presets for 1-click discovery in the skill selection view.
 */
export const POPULAR_SKILL_PRESETS = [
  { label: '⚡ Concurrency & Low Latency', skills: ['Concurrency', 'Low Latency', 'Multithreading', 'Thread Safety', 'Lock-Free Data Structures', 'High Throughput'] },
  { label: '🌐 Distributed Systems', skills: ['Distributed Systems', 'Microservices', 'Event-Driven Architecture', 'Kafka', 'CQRS', 'gRPC'] },
  { label: '☕ Java Ecosystem', skills: ['Java', 'Spring Boot', 'Spring Security', 'Hibernate', 'JVM', 'Garbage Collection Tuning'] },
  { label: '🐍 Python & AI', skills: ['Python', 'FastAPI', 'Machine Learning', 'Large Language Models (LLMs)', 'RAG', 'PyTorch'] },
  { label: '📊 Big Data & Streaming', skills: ['PySpark', 'Apache Spark', 'Apache Kafka', 'ETL Pipelines', 'Snowflake', 'PostgreSQL'] },
  { label: '☁️ Cloud & DevOps', skills: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD Pipelines', 'Prometheus & Grafana'] },
  { label: '🛡️ Security & Testing', skills: ['Web Security & OWASP', 'OAuth 2.0 & OIDC', 'QA Automation', 'Playwright', 'Unit Testing & TDD'] },
];
