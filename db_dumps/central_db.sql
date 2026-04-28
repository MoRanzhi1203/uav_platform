-- MySQL dump 10.13  Distrib 8.0.18, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: central_db
-- ------------------------------------------------------
-- Server version	8.0.18

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group`
--

LOCK TABLES `auth_group` WRITE;
/*!40000 ALTER TABLE `auth_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group_permissions`
--

LOCK TABLES `auth_group_permissions` WRITE;
/*!40000 ALTER TABLE `auth_group_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_permission`
--

LOCK TABLES `auth_permission` WRITE;
/*!40000 ALTER TABLE `auth_permission` DISABLE KEYS */;
INSERT INTO `auth_permission` VALUES (1,'Can add permission',1,'add_permission'),(2,'Can change permission',1,'change_permission'),(3,'Can delete permission',1,'delete_permission'),(4,'Can view permission',1,'view_permission'),(5,'Can add group',2,'add_group'),(6,'Can change group',2,'change_group'),(7,'Can delete group',2,'delete_group'),(8,'Can view group',2,'view_group'),(9,'Can add content type',3,'add_contenttype'),(10,'Can change content type',3,'change_contenttype'),(11,'Can delete content type',3,'delete_contenttype'),(12,'Can view content type',3,'view_contenttype'),(13,'Can add session',4,'add_session'),(14,'Can change session',4,'change_session'),(15,'Can delete session',4,'delete_session'),(16,'Can view session',4,'view_session'),(17,'Can add operation log',5,'add_operationlog'),(18,'Can change operation log',5,'change_operationlog'),(19,'Can delete operation log',5,'delete_operationlog'),(20,'Can view operation log',5,'view_operationlog'),(21,'Can add role permission',6,'add_rolepermission'),(22,'Can change role permission',6,'change_rolepermission'),(23,'Can delete role permission',6,'delete_rolepermission'),(24,'Can view role permission',6,'view_rolepermission'),(25,'Can add system_user',7,'add_systemuser'),(26,'Can change system_user',7,'change_systemuser'),(27,'Can delete system_user',7,'delete_systemuser'),(28,'Can view system_user',7,'view_systemuser'),(29,'Can add drone',8,'add_drone'),(30,'Can change drone',8,'change_drone'),(31,'Can delete drone',8,'delete_drone'),(32,'Can view drone',8,'view_drone'),(33,'Can add drone_group',9,'add_dronegroup'),(34,'Can change drone_group',9,'change_dronegroup'),(35,'Can delete drone_group',9,'delete_dronegroup'),(36,'Can view drone_group',9,'view_dronegroup'),(37,'Can add launch_site',10,'add_launchsite'),(38,'Can change launch_site',10,'change_launchsite'),(39,'Can delete launch_site',10,'delete_launchsite'),(40,'Can view launch_site',10,'view_launchsite'),(41,'Can add pilot',11,'add_pilot'),(42,'Can change pilot',11,'change_pilot'),(43,'Can delete pilot',11,'delete_pilot'),(44,'Can view pilot',11,'view_pilot'),(45,'Can add drone_group_member',12,'add_dronegroupmember'),(46,'Can change drone_group_member',12,'change_dronegroupmember'),(47,'Can delete drone_group_member',12,'delete_dronegroupmember'),(48,'Can view drone_group_member',12,'view_dronegroupmember'),(49,'Can add fire_detection',13,'add_firedetection'),(50,'Can change fire_detection',13,'change_firedetection'),(51,'Can delete fire_detection',13,'delete_firedetection'),(52,'Can view fire_detection',13,'view_firedetection'),(53,'Can add forest_area',14,'add_forestarea'),(54,'Can change forest_area',14,'change_forestarea'),(55,'Can delete forest_area',14,'delete_forestarea'),(56,'Can view forest_area',14,'view_forestarea'),(57,'Can add forest_patrol_task',15,'add_forestpatroltask'),(58,'Can change forest_patrol_task',15,'change_forestpatroltask'),(59,'Can delete forest_patrol_task',15,'delete_forestpatroltask'),(60,'Can view forest_patrol_task',15,'view_forestpatroltask'),(61,'Can add agri_task',16,'add_agritask'),(62,'Can change agri_task',16,'change_agritask'),(63,'Can delete agri_task',16,'delete_agritask'),(64,'Can view agri_task',16,'view_agritask'),(65,'Can add farm_plot',17,'add_farmplot'),(66,'Can change farm_plot',17,'change_farmplot'),(67,'Can delete farm_plot',17,'delete_farmplot'),(68,'Can view farm_plot',17,'view_farmplot'),(69,'Can add pest_monitor',18,'add_pestmonitor'),(70,'Can change pest_monitor',18,'change_pestmonitor'),(71,'Can delete pest_monitor',18,'delete_pestmonitor'),(72,'Can view pest_monitor',18,'view_pestmonitor'),(73,'Can add global_task',19,'add_globaltask'),(74,'Can change global_task',19,'change_globaltask'),(75,'Can delete global_task',19,'delete_globaltask'),(76,'Can view global_task',19,'view_globaltask'),(77,'Can add task_dispatch',20,'add_taskdispatch'),(78,'Can change task_dispatch',20,'change_taskdispatch'),(79,'Can delete task_dispatch',20,'delete_taskdispatch'),(80,'Can view task_dispatch',20,'view_taskdispatch'),(81,'Can add federation_query_record',21,'add_federationqueryrecord'),(82,'Can change federation_query_record',21,'change_federationqueryrecord'),(83,'Can delete federation_query_record',21,'delete_federationqueryrecord'),(84,'Can view federation_query_record',21,'view_federationqueryrecord'),(85,'Can add federation_stat_snapshot',22,'add_federationstatsnapshot'),(86,'Can change federation_stat_snapshot',22,'change_federationstatsnapshot'),(87,'Can delete federation_stat_snapshot',22,'delete_federationstatsnapshot'),(88,'Can view federation_stat_snapshot',22,'view_federationstatsnapshot'),(89,'Can add drone_heartbeat',23,'add_droneheartbeat'),(90,'Can change drone_heartbeat',23,'change_droneheartbeat'),(91,'Can delete drone_heartbeat',23,'delete_droneheartbeat'),(92,'Can view drone_heartbeat',23,'view_droneheartbeat'),(93,'Can add flight_trajectory',24,'add_flighttrajectory'),(94,'Can change flight_trajectory',24,'change_flighttrajectory'),(95,'Can delete flight_trajectory',24,'delete_flighttrajectory'),(96,'Can view flight_trajectory',24,'view_flighttrajectory'),(97,'Can add telemetry_snapshot',25,'add_telemetrysnapshot'),(98,'Can change telemetry_snapshot',25,'change_telemetrysnapshot'),(99,'Can delete telemetry_snapshot',25,'delete_telemetrysnapshot'),(100,'Can view telemetry_snapshot',25,'view_telemetrysnapshot'),(101,'Can add terrain',26,'add_terrain'),(102,'Can change terrain',26,'change_terrain'),(103,'Can delete terrain',26,'delete_terrain'),(104,'Can view terrain',26,'view_terrain'),(105,'Can add terrain_feature',27,'add_terrainfeature'),(106,'Can change terrain_feature',27,'change_terrainfeature'),(107,'Can delete terrain_feature',27,'delete_terrainfeature'),(108,'Can view terrain_feature',27,'view_terrainfeature'),(109,'Can add terrain_type',28,'add_terraintype'),(110,'Can change terrain_type',28,'change_terraintype'),(111,'Can delete terrain_type',28,'delete_terraintype'),(112,'Can view terrain_type',28,'view_terraintype'),(113,'Can add 地块',29,'add_terrainplot'),(114,'Can change 地块',29,'change_terrainplot'),(115,'Can delete 地块',29,'delete_terrainplot'),(116,'Can view 地块',29,'view_terrainplot'),(117,'Can add 区域',30,'add_terrainarea'),(118,'Can change 区域',30,'change_terrainarea'),(119,'Can delete 区域',30,'delete_terrainarea'),(120,'Can view 区域',30,'view_terrainarea'),(121,'Can add 地块',31,'add_terrainzone'),(122,'Can change 地块',31,'change_terrainzone'),(123,'Can delete 地块',31,'delete_terrainzone'),(124,'Can view 地块',31,'view_terrainzone'),(125,'Can add 要素',32,'add_terrainelement'),(126,'Can change 要素',32,'change_terrainelement'),(127,'Can delete 要素',32,'delete_terrainelement'),(128,'Can view 要素',32,'view_terrainelement'),(129,'Can add 子类别',33,'add_terrainsubcategory'),(130,'Can change 子类别',33,'change_terrainsubcategory'),(131,'Can delete 子类别',33,'delete_terrainsubcategory'),(132,'Can view 子类别',33,'view_terrainsubcategory');
/*!40000 ALTER TABLE `auth_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_content_type`
--

LOCK TABLES `django_content_type` WRITE;
/*!40000 ALTER TABLE `django_content_type` DISABLE KEYS */;
INSERT INTO `django_content_type` VALUES (16,'agri','agritask'),(17,'agri','farmplot'),(18,'agri','pestmonitor'),(2,'auth','group'),(1,'auth','permission'),(3,'contenttypes','contenttype'),(21,'federation','federationqueryrecord'),(22,'federation','federationstatsnapshot'),(8,'fleet','drone'),(9,'fleet','dronegroup'),(12,'fleet','dronegroupmember'),(10,'fleet','launchsite'),(11,'fleet','pilot'),(13,'forest','firedetection'),(14,'forest','forestarea'),(15,'forest','forestpatroltask'),(4,'sessions','session'),(5,'system','operationlog'),(6,'system','rolepermission'),(7,'system','systemuser'),(19,'tasking','globaltask'),(20,'tasking','taskdispatch'),(23,'telemetry','droneheartbeat'),(24,'telemetry','flighttrajectory'),(25,'telemetry','telemetrysnapshot'),(26,'terrain','terrain'),(30,'terrain','terrainarea'),(32,'terrain','terrainelement'),(27,'terrain','terrainfeature'),(29,'terrain','terrainplot'),(33,'terrain','terrainsubcategory'),(28,'terrain','terraintype'),(31,'terrain','terrainzone');
/*!40000 ALTER TABLE `django_content_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'agri','0001_initial','2026-04-11 12:58:42.874431'),(2,'contenttypes','0001_initial','2026-04-11 12:58:42.943262'),(3,'contenttypes','0002_remove_content_type_name','2026-04-11 12:58:43.096558'),(4,'auth','0001_initial','2026-04-11 12:58:43.581602'),(5,'auth','0002_alter_permission_name_max_length','2026-04-11 12:58:43.693537'),(6,'auth','0003_alter_user_email_max_length','2026-04-11 12:58:43.703427'),(7,'auth','0004_alter_user_username_opts','2026-04-11 12:58:43.711370'),(8,'auth','0005_alter_user_last_login_null','2026-04-11 12:58:43.722821'),(9,'auth','0006_require_contenttypes_0002','2026-04-11 12:58:43.728010'),(10,'auth','0007_alter_validators_add_error_messages','2026-04-11 12:58:43.742054'),(11,'auth','0008_alter_user_username_max_length','2026-04-11 12:58:43.750941'),(12,'auth','0009_alter_user_last_name_max_length','2026-04-11 12:58:43.760033'),(13,'auth','0010_alter_group_name_max_length','2026-04-11 12:58:43.859343'),(14,'auth','0011_update_proxy_permissions','2026-04-11 12:58:43.873141'),(15,'auth','0012_alter_user_first_name_max_length','2026-04-11 12:58:43.879735'),(16,'federation','0001_initial','2026-04-11 12:58:43.972334'),(17,'federation','0002_federationqueryrecord_requester_id','2026-04-11 12:58:44.020253'),(18,'fleet','0001_initial','2026-04-11 12:58:44.274813'),(19,'forest','0001_initial','2026-04-11 12:58:44.282419'),(20,'sessions','0001_initial','2026-04-11 12:58:44.344653'),(21,'system','0001_initial','2026-04-11 12:58:44.964904'),(22,'system','0002_alter_rolepermission_options_and_more','2026-04-11 12:58:45.024086'),(23,'tasking','0001_initial','2026-04-11 12:58:45.118006'),(24,'telemetry','0001_initial','2026-04-11 12:58:45.239274'),(25,'agri','0002_farmplot_terrain_id','2026-04-11 17:24:36.790988'),(26,'forest','0002_forestarea_terrain_id','2026-04-11 17:24:36.801191'),(27,'terrain','0001_initial','2026-04-11 17:24:36.812614'),(28,'terrain','0002_delete_terrainfeature_delete_terraintype_and_more','2026-04-12 16:55:32.123571'),(29,'terrain','0003_terrainplot','2026-04-13 20:49:17.940113'),(30,'terrain','0004_terrainarea_terrainelement_terrainzone_and_more','2026-04-13 23:28:59.667600'),(31,'terrain','0005_terrainsubcategory','2026-04-14 03:26:02.221581'),(32,'terrain','0006_terrainarea_is_deleted_alter_terrainarea_type_and_more','2026-04-14 03:26:02.235487'),(33,'terrain','0007_terrainsubcategory_is_default_and_more','2026-04-14 12:20:00.448351'),(34,'terrain','0008_alter_terrainelement_options_and_more','2026-04-15 16:19:45.578824');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_session`
--

LOCK TABLES `django_session` WRITE;
/*!40000 ALTER TABLE `django_session` DISABLE KEYS */;
INSERT INTO `django_session` VALUES ('13nb3bb06hju17slmo72m60g3sj9wifc','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZQi:_eKsaaALLk6wR8RgJg2zeUS44Uzbrkd2QCYAA3BcoGw','2026-04-12 10:35:24.567401'),('14ltozrixya5wig7t4ezzlnf9lotj3iq','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wEPOP:iZHUYFuM19Uh85NjQ01ro81se4__mEQQXqf971Eogaw','2026-04-20 06:28:45.709298'),('1rnj2ih4j7sly0mt164j65ba21tm8yxi','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wDRsy:buzi2Ua7O9ARUXxf_Vedh1U5hS9Ku_iqU_C5yDwZtTM','2026-04-17 14:56:20.760612'),('1zobng2ls6f5ukb736ojux5sb4zefcgp','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZNQ:NjC-eLWCyY_x9PEJaS_-UJdHEQ4EFUCGJLOMsGT2bls','2026-04-12 10:32:00.208202'),('2jod7ir3vur8m6amuq2t8f5xj5to75sq','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbVv:Efxp0hCoqPg0GKC1a4FSIms9NX_Mtft8GPex05oiTig','2026-04-12 12:48:55.181830'),('2r6de6dbr4gm2od5a30oea6bpjuejl8v','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBba0:WeyqAbsSiWLS_diDrHxLpkDiP6T-aux86pGxcDGQ2pM','2026-04-12 12:53:08.752427'),('44mefetlbv8g68yjtsm9xxzlggiofxu1','.eJxVjssKwjAURP8lawlNzdOl-35DyH3EVCWFpl2J_24LRXQ7Z-YwLxHTupS4Np7jSOIilDj9ZpDwwXUHdE_1Nkmc6jKPIPeKPGiTw0T8vB7dP0FJrWzrDKR1Yq8g6Jxd7xhtBqX6xBpzIMu6O7NnRGOMdYieggagznjlssdN-v2o3h_ZijzO:1wCV1l:_ogK_7KCR3wzgJXrk85Sapv_q6Lked-m4kpH5srNiXE','2026-04-15 00:05:29.127210'),('4zsltt513at75wsmr7dt7rojcd6hfv6p','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBZEd:q-z9LilzBD_4SjIeTEMTVMgRaP1vztpEQ36tAzdBTEg','2026-04-12 10:22:55.649519'),('5czzk7ptzu861u3x37n0dm2pd03q7m1j','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbWl:QojBaNFl4wfKipKAVHul3r5JpB0KRqOcKPhHBDQNxnE','2026-04-12 12:49:47.457860'),('5zru03qgbyoyuxh5wruglp5luw2pc9qy','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbat:L3mUMHo9sY5XE9VFExSoEIUY5DWFrgFJDLnjhZw0JtE','2026-04-12 12:54:03.353680'),('6104onht089853crro47ggfjirsos06q','.eJxVjssKwjAURP8lawlNzdOl-35DyH3EVCWFpl2J_24LRXQ7Z-YwLxHTupS4Np7jSOIilDj9ZpDwwXUHdE_1Nkmc6jKPIPeKPGiTw0T8vB7dP0FJrWzrDKR1Yq8g6Jxd7xhtBqX6xBpzIMu6O7NnRGOMdYieggagznjlssdN-v2o3h_ZijzO:1wCd3N:x56IztD0Ddj_kT-GrWIcnW3u0wbLLf-X6w5W-P5J1qg','2026-04-15 08:39:41.265931'),('65i8cc26onkvqocglu7mn422dzk8hby4','e30:1wBaPS:U0SL-lYuTQqGFTu_aRmCMpUR6PWXcueU9JB3_J8D6jg','2026-04-12 11:38:10.427734'),('6o690xrlr2muqr9tygzkcap4w1qzcmf0','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBafG:nyfJzOrSQKDGl6oLvymmJDKAESafl5b0wduLaPlxwII','2026-04-12 11:54:30.533208'),('73l2i8wqzimwtw6xkold2t2ayzpsyq0y','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wDlIa:WJ1b0lqSuuXLXfTyNKlK0cXy-maVvrSLILQUoEnZqTI','2026-04-18 11:40:04.927557'),('7bkho8zy9c58wixqa8jx3ibpdhpvscnr','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wDtXn:D5bNVTnbIq6RzWuANEhACjYrMPHzCEiPiYIGYrwX51I','2026-04-18 20:28:19.426402'),('7buubad7byh2wb1uldh9vgduo7iwi66x','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBYoB:CToCvYTUgxKIrLrppiggmiGAWYlzZSqGlUHMtaA4vh4','2026-04-12 09:55:35.313512'),('7vnjv2r2ugftv4w0zxjalzc6heghbwo7','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBZJ9:aaRbfeczQgnuKkqei9WHKvu7KEeQKWN3m_nWx7c9HNU','2026-04-12 10:27:35.062897'),('8301ehua1nw4eval2daqbqay6tg5ftjh','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBcbX:dlcx_CJrI7z42b7i-_AQQ4kq-Fz1B7BuQzxddGjRyak','2026-04-12 13:58:47.682181'),('90jfndrd0ikf6ggrplqbsvjbw9lkug8z','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wHhfa:C73MPD5lS81hz75lcNgdWOBbvjVOTQUCWXgYQ8sz_fo','2026-04-29 08:36:06.762847'),('9c6srh6mwmy6vgdck9opl46miex1zgj5','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wDoX1:WzGcKZGpXEOUl7n36m9Av1e2_hxf9VLB9i2MPUGkrpw','2026-04-18 15:07:11.912901'),('a2ixftlckp1a8kk5b7hb47aqwbdmbzye','.eJxVjssKwjAURP8lawlNzdOl-35DyH3EVCWFpl2J_24LRXQ7Z-YwLxHTupS4Np7jSOIilDj9ZpDwwXUHdE_1Nkmc6jKPIPeKPGiTw0T8vB7dP0FJrWzrDKR1Yq8g6Jxd7xhtBqX6xBpzIMu6O7NnRGOMdYieggagznjlssdN-v2o3h_ZijzO:1wCW7v:RI3PeDEy7LCx17dOC-qRECYxsg-4d7_X-ERd-q5rYq0','2026-04-15 01:15:55.931631'),('aj93bji4f6uqssnd9u5s0eavt3s76jkj','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbY0:BIIj3lWtKjekQQi2bEBZALLTQ1_z4ne2pjE_CIaI5q8','2026-04-12 12:51:04.952121'),('bcduw8gimndk7awwtv80xm291q63wg6b','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBnS4:7FMfZWDZhZe6f7DRvsTXcWwhXSAlp5rB-q7zL6SfjCU','2026-04-13 01:33:44.056656'),('bt1ua3mznqnwtvbanq3kzeehgi0ug299','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbdh:k4d6T1TDbNOjmnnZA0GAIgT9cVvrkRLI3IBdbaDsPHk','2026-04-12 12:56:57.278989'),('c66h47k1qvba60x31xi63tvz18cp0htg','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBn9Q:PabzQBRBZoA8rYoP1hYvyNNSlrsZfdHuqravkYeqiFo','2026-04-13 01:14:28.344712'),('c7r5lxmkx9tdnwnjzknoc2ol92usm2bh','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBaRA:H49CSX-QFzD68bTbgFPGmKPDyII5hG3zG6jIxrxtLDs','2026-04-12 11:39:56.064297'),('c83m9hjc44iuf2of6yl25zk31ju1qe3d','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbfn:q5T6gUdMw1jaCJZ_Tbbh-s7Y75cXNhPfdflHWkJvZBE','2026-04-12 12:59:07.424509'),('c9doy0jjkb29k1756t4dzukt7x15ooly','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBrmS:fmTKlcYtcwhUtRwvnloIflwfXccHddj2glUNBrArW1k','2026-04-13 06:11:04.390768'),('cjzhuumn3rrxtczjzsraot60coy3hrdm','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBcXO:diMaPqt7Wycu-iv_9a_5autQQ6dgDUn7nVOP_C70gU0','2026-04-12 13:54:30.054156'),('cx26hifg1cc1vtju6fubdtzmp94ehr4y','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wE1nq:B7OGTYTpKKk2ujXUHlWOK32V6YR3pwcwWdBf13VvagM','2026-04-19 05:17:26.242823'),('ddf1uzrzsxex5wm9fl9s84bl4g1wxmga','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBaPv:ocr4_MRQRPgsI1tUDgw7rjRQCJkGiFloojz7RhuHMFs','2026-04-12 11:38:39.444914'),('djl5lqonz1gngwh8ml9jtnmdohik38an','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBcSR:EE39it4hyTs5kXa1N4r9wpM8tWra84FqOcKIfiaYzsw','2026-04-12 13:49:23.635257'),('dlh7u4b8qko26g9z94f7w5o7pr9dprk6','.eJxVjDsOwjAQRO_iGlmJk_WHkj5niHbXaxxAtpRPhbg7iZQCypn3Zt5qxG3N47bIPE5RXVWrLr8dIT-lHCA-sNyr5lrWeSJ9KPqkix5qlNftdP8OMi55XzsvqYkWfdtRCE0TGCgARi9M0ZAY9tY5DwJ77ixak1LokncA3HNP6vMF9ns4gQ:1wBQRt:4dyGCcwJluRnKKmE2yZO1NFf3eJFol5UifuzJXkc8AY','2026-04-12 01:00:01.206195'),('dolasvruq8vugz4j1yqqrt4n44pp2fze','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZMk:ify9brKq_gUrrWHt0dLUX8_VH8wbfPRu0R_IADfLkAU','2026-04-12 10:31:18.975513'),('eggfomvz8ymdcw0efi836te73zx4iubv','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZWR:06H6ydS_Az1o96V8cC7a0b-GSDR7GRpKSK7ILZi8NL8','2026-04-12 10:41:19.331485'),('elkrdpwdf0b90fwv904iwpu3ru2zxwq6','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbsd:yL1SYQlS0SpkYkRbp_181MH_6E1CTSktssDwtVgG0qs','2026-04-12 13:12:23.560192'),('f9rcuacif2erwpsdbhsyjjk1niqaho8a','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBYjZ:Kt4j0jbrq_xgHMOfzRrCSymjZEEP2fxWnSIw2plByoE','2026-04-12 09:50:49.105697'),('h0qeiktrcne7wanemohd7gv8o3ozo0si','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBaOe:ZtExeBIb-qHfCw4jRlW0eD1BRBBA4n9IH3io2BZs7Po','2026-04-12 11:37:20.744234'),('h8labn0inq2ykb1f6k0y27r3mhxav49u','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBaQf:wT0tH-EgxcrfSKd4uY1JIKJcC5Vj3R5jAHTJIEg5zeo','2026-04-12 11:39:25.578773'),('hh7xh8v4rwkgodjeabgzo9631qbodkun','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBZCd:ddPDUV1oYsjKt6X6mzERS15cMl6OvDGC_FOLMU7rWtc','2026-04-12 10:20:51.225089'),('jqvggsy88n5sbyv620n5y03n64q43c70','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbeH:un4C4HhqEF1sT-K_C39kRVe7o3hmnlwr5zGGu_Agj7Y','2026-04-12 12:57:33.853418'),('k389otgzz4icpxechnr6bfu7t3c24il5','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbsr:DkyNLSR7M-iwjqJhBQowjBXKf5NxpFxqrtxS4NYIEeE','2026-04-12 13:12:37.678092'),('kfh6d7g7it2g5mb63yre8n3nru36nfn8','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBZ9d:9As0Dh1Mijudh9L-ILHLQXV1q3Q7YFkTCDe91qZYrug','2026-04-12 10:17:45.675547'),('krvfbnbjjz8tgi9h5h4v33234u92zzf3','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wDwbA:3Cx_e-muulB8B9WwaCfyKsZ-S7rnEaBG8qPHCXziZ6E','2026-04-18 23:44:00.013764'),('l4geb2l3no8u4kka2szw02cw7uyfhkaq','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZyv:_9ygDRyfBlOsMQW4TdcHtRPGUhCCgfSERwlXMkPmkwo','2026-04-12 11:10:45.564783'),('m78d0xauyfwjaq1ge72rzjcfkped4oqw','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBsEr:rzzPcIIAJ480-8fBg4aatCcO4r5hlvJXpIKgQ1yq9TA','2026-04-13 06:40:25.429041'),('mxdfcopvl0lixiprs5iql0j3qfrczxli','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbtp:AKms8kNhwZUUjBGvrvpLnSZ0IwFUObvyUHK8guC5CX8','2026-04-12 13:13:37.020627'),('n1gcpnjq6divis0kctnjk0j1b9ecyemh','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbXv:pr5HBGgXBeTtZDERsmZqXtBdEBDzDmTrAxx6N4pDy-U','2026-04-12 12:50:59.540972'),('n7auokoosoqbrmc9nxyqhsf9065n43wx','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBcXq:dLuRzkdjShN5uety4pbccBgCOdpL01MInQ4_W1C9vrw','2026-04-12 13:54:58.753304'),('qx3r485inkw8q9xu1hf0iaseiapn2u7x','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wEraU:lQaouvEabAL0-1yGBVBgc4Ad6-i4PA-o63oO6LBUe4U','2026-04-21 12:35:06.387052'),('rb5wg7l3vv1t3zvr1et8rzp5j5xqs8ny','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBaOE:QcKDjnQic4TRydZb6N-QzsfKgZTA4MT6YUe0V04pvw0','2026-04-12 11:36:54.795637'),('rk4d5eodslux63czcxfslprtq0bo7m4q','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZzA:Us8M1Qx1EJXB-4mTNxtoaiitXew8-1-pA7ZTvnpauxM','2026-04-12 11:11:00.325526'),('s41mf0wdprmygkrtmro4fdiqy1mretzr','.eJxVjssOwiAURP-FtSE8BVy67zeQC_ciVUOT0q6M_26bNEa3c2ZO5sUirEuNa6c5jsguTLLTb5YgP6jtAO_QbhPPU1vmMfG9wg_a-TAhPa9H909QoddtnbO0xhZBRgtlz9ZpGZwigxCcA5WKAYGClPeYCSnZUDRI0in7IIvSm_T7Ub4_i_Q7ww:1wDjkV:dO-z5W_LrwubAa74hj6sijtGDGvHnWT5-wQhh85C0hY','2026-04-18 10:00:47.801295'),('sj9rk39xb0gnn9pcyqgfrs21g95l146d','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBaQt:FIIEyDtohxPGe-JQrkYwjUlCP1r0geSWCwuqiSnl4OI','2026-04-12 11:39:39.854012'),('t7r828fj03bvsyojgkkk30djohn4ygpn','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbf6:Zfg6PYXS74mdvK80gt9vg-HP5WVHHsgAJHXCSP1Jdqw','2026-04-12 12:58:24.807605'),('tee0610sqq3xh89vlhqabdielklaput3','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbYE:UUXHXwdUds5aRtSnuJq09DzpR7zBkfDWv2_PcgXd46I','2026-04-12 12:51:18.836921'),('vakljzgad4qv8wdnqygcytfoi9ujbuw9','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBcYL:zGOREETmaExaNGoQpBz_m2QtR-sj2l2NIQn_1QHtddw','2026-04-12 13:55:29.647646'),('vqhh2zkp3rbie55hczak25vh5cbqtjvs','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbjO:_6jRb8-l6JyX9fW7AsIObTcjlwnRRleM1HXEQG00y_o','2026-04-12 13:02:50.803510'),('wbyopuvnjny3z00pdi9fgcrdwcwiehyg','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBZ7C:o--Lv6zDXGGQFNWR_X14gNGeOrgsQf3MiSCAxfFBMiU','2026-04-12 10:15:14.029762'),('wu97zij66qzt15yo60f1631rmnqvu3wc','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wCByU:rZb8ruIlhCV-v2zfn7ZuZFytWOHb-08uo_pC0xwW2vw','2026-04-14 03:44:50.950548'),('x7ztf5ihj81dki62e5f88h8kmgpezkun','.eJxVjEEOwiAQRe_C2hCmUxjq0r1nIDNApWpoUtqV8e7apAvd_vfef6nA21rC1vISpqTOCtTpdxOOj1x3kO5cb7OOc12XSfSu6IM2fZ1Tfl4O9--gcCvfWuwYiax4kwYEQpMHQCeRAJyJXghRnBMPKSfP2XQ9Ycemd6M1jATq_QHMNTcD:1wBYk7:UamkUpd8z-orJ2ZUcQcEmJqJDaPh3UBKcUST8_goP1s','2026-04-12 09:51:23.339846'),('xj5gpxoycimaneoelb9twx5a98en2xi7','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBbtY:bt_w-uQ9S_kAGz4oS4gOgNNbBGBB7RHnrp37d8sds5w','2026-04-12 13:13:20.017357'),('yt5bjc3z8hn55ah08dcgi7ch3r70nc0q','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBbc4:_26Sxgrf41av-VR0OoOPZWwhKvLiC8mpkaaQudZJPRo','2026-04-12 12:55:16.026477'),('zl4qgetqwaw6sm050ppen021oa8sz8zg','.eJxVjs0KAiEURt_FdYh6Tb0t2_cMcv2ZnAqFcWYVvXsJQ9T2O4fD92SetrX4refFz4mdmGSH3y1QvOc6QLpRvTYeW12XOfCh8J12fmkpP867-xco1MvIugBTRNROZ3Bk0GUIURsUVgqlkSJQ0HA0ytrkojEuWwIFYgIEsOoT_X6UrzdpjTpg:1wBrYy:t_8gaygNFBunMhQ38qYgdORb9yLbPo1zwcCttI0dmek','2026-04-13 05:57:08.408603'),('zmwmev5dssf8fn2o6o0xof35s2svulnx','.eJxVjEEOwiAQAP_C2RDKIiwevfsGssBWqgaS0p6MfzckPeh1ZjJvEWjfStg7r2HJ4iImcfplkdKT6xD5QfXeZGp1W5coRyIP2-WtZX5dj_ZvUKiXscUIc_LeoGFAsh4ZYjLWKzcpbTwloGjgbLVzGZO1yI5Ag5rBAzgtPl_C8zaa:1wBZJv:RHvsfuypHi0MQzI2qPuah7DhM8jmcR20WxdW7Az5n7Y','2026-04-12 10:28:23.474275');
/*!40000 ALTER TABLE `django_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `federation_query_record`
--

DROP TABLE IF EXISTS `federation_query_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `federation_query_record` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `query_code` varchar(64) NOT NULL,
  `query_name` varchar(128) NOT NULL,
  `query_scope` varchar(64) NOT NULL,
  `source_dbs` varchar(64) NOT NULL,
  `result_count` int(11) NOT NULL,
  `query_status` varchar(32) NOT NULL,
  `remark` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `requester_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `query_code` (`query_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `federation_query_record`
--

LOCK TABLES `federation_query_record` WRITE;
/*!40000 ALTER TABLE `federation_query_record` DISABLE KEYS */;
/*!40000 ALTER TABLE `federation_query_record` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `federation_stat_snapshot`
--

DROP TABLE IF EXISTS `federation_stat_snapshot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `federation_stat_snapshot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `snapshot_code` varchar(64) NOT NULL,
  `stat_date` date NOT NULL,
  `central_task_count` int(11) NOT NULL,
  `forest_event_count` int(11) NOT NULL,
  `agri_event_count` int(11) NOT NULL,
  `total_dispatch_count` int(11) NOT NULL,
  `snapshot_status` varchar(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `snapshot_code` (`snapshot_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `federation_stat_snapshot`
--

LOCK TABLES `federation_stat_snapshot` WRITE;
/*!40000 ALTER TABLE `federation_stat_snapshot` DISABLE KEYS */;
/*!40000 ALTER TABLE `federation_stat_snapshot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fleet_drone`
--

DROP TABLE IF EXISTS `fleet_drone`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fleet_drone` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `drone_code` varchar(64) NOT NULL,
  `drone_name` varchar(128) NOT NULL,
  `model_name` varchar(128) NOT NULL,
  `serial_no` varchar(128) NOT NULL,
  `max_payload` decimal(8,2) NOT NULL,
  `battery_capacity` decimal(8,2) NOT NULL,
  `status` varchar(32) NOT NULL,
  `launch_site_id` bigint(20) NOT NULL,
  `pilot_id` bigint(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drone_code` (`drone_code`),
  UNIQUE KEY `serial_no` (`serial_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fleet_drone`
--

LOCK TABLES `fleet_drone` WRITE;
/*!40000 ALTER TABLE `fleet_drone` DISABLE KEYS */;
/*!40000 ALTER TABLE `fleet_drone` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fleet_drone_group`
--

DROP TABLE IF EXISTS `fleet_drone_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fleet_drone_group` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `group_code` varchar(64) NOT NULL,
  `group_name` varchar(128) NOT NULL,
  `scene_type` varchar(32) NOT NULL,
  `command_level` varchar(32) NOT NULL,
  `status` varchar(32) NOT NULL,
  `description` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_code` (`group_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fleet_drone_group`
--

LOCK TABLES `fleet_drone_group` WRITE;
/*!40000 ALTER TABLE `fleet_drone_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `fleet_drone_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fleet_drone_group_member`
--

DROP TABLE IF EXISTS `fleet_drone_group_member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fleet_drone_group_member` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `group_id` bigint(20) NOT NULL,
  `drone_id` bigint(20) NOT NULL,
  `role_name` varchar(64) NOT NULL,
  `join_status` varchar(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fleet_drone_group_member_group_id_drone_id_6a10084a_uniq` (`group_id`,`drone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fleet_drone_group_member`
--

LOCK TABLES `fleet_drone_group_member` WRITE;
/*!40000 ALTER TABLE `fleet_drone_group_member` DISABLE KEYS */;
/*!40000 ALTER TABLE `fleet_drone_group_member` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fleet_launch_site`
--

DROP TABLE IF EXISTS `fleet_launch_site`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fleet_launch_site` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `site_name` varchar(128) NOT NULL,
  `region` varchar(128) NOT NULL,
  `longitude` decimal(10,6) NOT NULL,
  `latitude` decimal(10,6) NOT NULL,
  `altitude` decimal(8,2) NOT NULL,
  `status` varchar(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fleet_launch_site`
--

LOCK TABLES `fleet_launch_site` WRITE;
/*!40000 ALTER TABLE `fleet_launch_site` DISABLE KEYS */;
/*!40000 ALTER TABLE `fleet_launch_site` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fleet_pilot`
--

DROP TABLE IF EXISTS `fleet_pilot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fleet_pilot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `system_user_id` bigint(20) NOT NULL,
  `pilot_name` varchar(64) NOT NULL,
  `license_no` varchar(64) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `skill_level` varchar(32) NOT NULL,
  `status` varchar(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `license_no` (`license_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fleet_pilot`
--

LOCK TABLES `fleet_pilot` WRITE;
/*!40000 ALTER TABLE `fleet_pilot` DISABLE KEYS */;
/*!40000 ALTER TABLE `fleet_pilot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_operation_log`
--

DROP TABLE IF EXISTS `system_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_operation_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `operator_id` bigint(20) NOT NULL,
  `operator_name` varchar(64) NOT NULL,
  `module` varchar(64) NOT NULL,
  `action` varchar(64) NOT NULL,
  `request_method` varchar(16) NOT NULL,
  `request_path` varchar(255) NOT NULL,
  `request_ip` varchar(64) NOT NULL,
  `extra_data` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_operation_log`
--

LOCK TABLES `system_operation_log` WRITE;
/*!40000 ALTER TABLE `system_operation_log` DISABLE KEYS */;
INSERT INTO `system_operation_log` VALUES (1,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 13:00:01.199198'),(2,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 17:27:30.349039'),(3,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 17:58:16.335169'),(4,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 21:50:49.100594'),(5,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 21:51:23.335142'),(6,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 21:55:35.307191'),(7,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:15:14.023426'),(8,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:17:45.667829'),(9,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:20:51.218830'),(10,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:22:55.644791'),(11,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:27:35.056899'),(12,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:28:23.470816'),(13,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:31:18.972520'),(14,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:32:00.205084'),(15,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:35:24.562728'),(16,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:38:38.714302'),(17,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 22:41:19.326464'),(18,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:10:45.559648'),(19,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:11:00.320346'),(20,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:36:54.788423'),(21,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:37:20.737570'),(22,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:38:10.437108'),(23,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:38:39.440968'),(24,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:39:25.572916'),(25,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:39:39.847625'),(26,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:39:56.056234'),(27,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:43:41.095956'),(28,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:44:19.932589'),(29,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:46:12.573149'),(30,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:46:31.973136'),(31,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:47:30.689099'),(32,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:48:22.388391'),(33,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:49:01.314542'),(34,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:49:07.798964'),(35,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:49:42.627909'),(36,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:49:53.195584'),(37,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:50:03.934613'),(38,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:50:38.477278'),(39,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:50:56.175609'),(40,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:51:45.339703'),(41,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:51:57.576922'),(42,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:52:37.792141'),(43,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-11 23:54:30.523656'),(44,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:48:55.174617'),(45,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:49:47.452860'),(46,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:50:49.995845'),(47,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:50:59.529721'),(48,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:51:04.942601'),(49,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:51:18.829328'),(50,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:53:08.744271'),(51,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:54:03.348485'),(52,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:55:16.020277'),(53,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:56:57.267225'),(54,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:57:33.847549'),(55,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:58:24.791711'),(56,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 00:59:07.413914'),(57,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:02:50.788462'),(58,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:12:15.114118'),(59,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:12:23.549755'),(60,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:12:37.664522'),(61,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:13:20.008046'),(62,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:13:37.010993'),(63,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:49:23.617108'),(64,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:54:30.043623'),(65,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:54:58.745069'),(66,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:55:29.638238'),(67,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 01:58:47.664983'),(68,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 13:14:28.336663'),(69,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 13:33:44.047832'),(70,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 17:40:47.628123'),(71,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 17:55:46.378924'),(72,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 17:57:08.394059'),(73,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 18:05:01.145533'),(74,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 18:11:04.380902'),(75,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 18:37:16.139663'),(76,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-12 18:40:25.421091'),(77,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-13 15:44:50.924887'),(78,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-13 16:29:50.352543'),(79,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-13 19:41:28.776451'),(80,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-13 20:03:17.953437'),(81,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 01:51:16.181248'),(82,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 04:17:53.922216'),(83,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 10:28:35.814607'),(84,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 10:28:42.153915'),(85,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 11:16:51.664094'),(86,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 12:05:29.108544'),(87,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 12:06:21.511960'),(88,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 12:15:59.978974'),(89,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 13:15:55.915331'),(90,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 13:18:49.026569'),(91,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-14 20:39:41.255954'),(92,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-16 17:17:00.352974'),(93,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-17 00:07:11.460839'),(94,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-17 02:56:20.749464'),(95,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-17 22:00:47.780264'),(96,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-17 23:40:04.911727'),(97,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-18 03:07:11.901365'),(98,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-18 08:28:19.409643'),(99,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-18 11:43:59.993822'),(100,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-18 17:17:26.232047'),(101,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-19 18:28:45.693383'),(102,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-21 00:18:03.707953'),(103,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-21 00:35:06.374284'),(104,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-28 13:00:58.591168'),(105,1,'admin','system','login','POST','/api/system/login/','127.0.0.1','{}','2026-04-28 20:36:06.739147');
/*!40000 ALTER TABLE `system_operation_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_role_permission`
--

DROP TABLE IF EXISTS `system_role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_role_permission` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `role_code` varchar(64) NOT NULL,
  `role_name` varchar(64) NOT NULL,
  `permissions` json NOT NULL,
  `description` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_code` (`role_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_role_permission`
--

LOCK TABLES `system_role_permission` WRITE;
/*!40000 ALTER TABLE `system_role_permission` DISABLE KEYS */;
INSERT INTO `system_role_permission` VALUES (1,'super_admin','超级管理员','[\"system:*\", \"fleet:*\", \"forest:*\", \"agri:*\", \"tasking:*\", \"federation:*\"]','平台最高权限角色','2026-04-11 12:59:37.414449','2026-04-17 02:51:09.267786'),(2,'dispatcher','统一调度员','[\"tasking:view\", \"tasking:dispatch\", \"fleet:view\", \"federation:view\"]','负责跨库任务协同调度','2026-04-11 12:59:37.423012','2026-04-17 02:51:09.277091'),(3,'forest_officer','林业专员','[\"forest:view\", \"forest:task\", \"federation:view\"]','负责森林巡检与火情监管','2026-04-11 12:59:37.430646','2026-04-17 02:51:09.289874'),(4,'agri_officer','农业专员','[\"agri:view\", \"agri:task\", \"federation:view\"]','负责农业植保与病虫害监管','2026-04-11 12:59:37.436693','2026-04-17 02:51:09.298846');
/*!40000 ALTER TABLE `system_role_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_user`
--

DROP TABLE IF EXISTS `system_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(150) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL,
  `real_name` varchar(64) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `user_type` varchar(32) NOT NULL,
  `roles` json NOT NULL,
  `department` varchar(128) NOT NULL,
  `region` varchar(128) NOT NULL,
  `last_login_ip` varchar(64) NOT NULL,
  `remark` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_user`
--

LOCK TABLES `system_user` WRITE;
/*!40000 ALTER TABLE `system_user` DISABLE KEYS */;
INSERT INTO `system_user` VALUES (1,'pbkdf2_sha256$1000000$7cKJ0TXvNIk4bq2Omgnyd6$nhZttuBHul1wkr1m9UkBAkSBqImkwJuLeXsl+5TrhTM=','2026-04-28 20:36:06.728516',1,'admin','','','',1,1,'2026-04-11 12:59:37.165351','系统管理员','','super_admin','[\"super_admin\", \"dispatcher\", \"forest_officer\", \"agri_officer\"]','平台管理中心','重庆市','127.0.0.1','','2026-04-11 12:59:37.166354','2026-04-17 02:51:09.256892');
/*!40000 ALTER TABLE `system_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_user_groups`
--

DROP TABLE IF EXISTS `system_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_user_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `systemuser_id` bigint(20) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_user_groups_systemuser_id_group_id_80e3523a_uniq` (`systemuser_id`,`group_id`),
  KEY `system_user_groups_group_id_925e6bcb_fk_auth_group_id` (`group_id`),
  CONSTRAINT `system_user_groups_group_id_925e6bcb_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `system_user_groups_systemuser_id_fd40b5de_fk_system_user_id` FOREIGN KEY (`systemuser_id`) REFERENCES `system_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_user_groups`
--

LOCK TABLES `system_user_groups` WRITE;
/*!40000 ALTER TABLE `system_user_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_user_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_user_user_permissions`
--

DROP TABLE IF EXISTS `system_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_user_user_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `systemuser_id` bigint(20) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_user_user_permiss_systemuser_id_permission_94a6ae3b_uniq` (`systemuser_id`,`permission_id`),
  KEY `system_user_user_per_permission_id_9339fa91_fk_auth_perm` (`permission_id`),
  CONSTRAINT `system_user_user_per_permission_id_9339fa91_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `system_user_user_per_systemuser_id_ffc78fa7_fk_system_us` FOREIGN KEY (`systemuser_id`) REFERENCES `system_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_user_user_permissions`
--

LOCK TABLES `system_user_user_permissions` WRITE;
/*!40000 ALTER TABLE `system_user_user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_user_user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasking_global_task`
--

DROP TABLE IF EXISTS `tasking_global_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasking_global_task` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `task_code` varchar(64) NOT NULL,
  `task_name` varchar(128) NOT NULL,
  `scene_type` varchar(32) NOT NULL,
  `priority` int(11) NOT NULL,
  `status` varchar(32) NOT NULL,
  `command_center` varchar(128) NOT NULL,
  `creator_id` bigint(20) NOT NULL,
  `description` varchar(255) NOT NULL,
  `planned_start` datetime(6) DEFAULT NULL,
  `planned_end` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_code` (`task_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasking_global_task`
--

LOCK TABLES `tasking_global_task` WRITE;
/*!40000 ALTER TABLE `tasking_global_task` DISABLE KEYS */;
/*!40000 ALTER TABLE `tasking_global_task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasking_task_dispatch`
--

DROP TABLE IF EXISTS `tasking_task_dispatch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasking_task_dispatch` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `global_task_id` bigint(20) NOT NULL,
  `dispatch_code` varchar(64) NOT NULL,
  `target_db` varchar(32) NOT NULL,
  `target_task_id` bigint(20) NOT NULL,
  `drone_group_id` bigint(20) NOT NULL,
  `dispatch_status` varchar(32) NOT NULL,
  `dispatcher_id` bigint(20) NOT NULL,
  `dispatched_at` datetime(6) NOT NULL,
  `remark` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dispatch_code` (`dispatch_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasking_task_dispatch`
--

LOCK TABLES `tasking_task_dispatch` WRITE;
/*!40000 ALTER TABLE `tasking_task_dispatch` DISABLE KEYS */;
/*!40000 ALTER TABLE `tasking_task_dispatch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telemetry_drone_heartbeat`
--

DROP TABLE IF EXISTS `telemetry_drone_heartbeat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telemetry_drone_heartbeat` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `drone_id` bigint(20) NOT NULL,
  `drone_code` varchar(64) NOT NULL,
  `heartbeat_status` varchar(32) NOT NULL,
  `cpu_usage` decimal(5,2) NOT NULL,
  `memory_usage` decimal(5,2) NOT NULL,
  `network_delay_ms` int(11) NOT NULL,
  `heartbeat_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telemetry_drone_heartbeat`
--

LOCK TABLES `telemetry_drone_heartbeat` WRITE;
/*!40000 ALTER TABLE `telemetry_drone_heartbeat` DISABLE KEYS */;
/*!40000 ALTER TABLE `telemetry_drone_heartbeat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telemetry_flight_trajectory`
--

DROP TABLE IF EXISTS `telemetry_flight_trajectory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telemetry_flight_trajectory` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `drone_id` bigint(20) NOT NULL,
  `global_task_id` bigint(20) NOT NULL,
  `seq_no` int(11) NOT NULL,
  `longitude` decimal(10,6) NOT NULL,
  `latitude` decimal(10,6) NOT NULL,
  `altitude` decimal(8,2) NOT NULL,
  `speed` decimal(8,2) NOT NULL,
  `sampled_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telemetry_flight_trajectory`
--

LOCK TABLES `telemetry_flight_trajectory` WRITE;
/*!40000 ALTER TABLE `telemetry_flight_trajectory` DISABLE KEYS */;
/*!40000 ALTER TABLE `telemetry_flight_trajectory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telemetry_snapshot`
--

DROP TABLE IF EXISTS `telemetry_snapshot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telemetry_snapshot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `drone_id` bigint(20) NOT NULL,
  `drone_code` varchar(64) NOT NULL,
  `battery_level` decimal(5,2) NOT NULL,
  `altitude` decimal(8,2) NOT NULL,
  `speed` decimal(8,2) NOT NULL,
  `longitude` decimal(10,6) NOT NULL,
  `latitude` decimal(10,6) NOT NULL,
  `flight_status` varchar(32) NOT NULL,
  `signal_strength` int(11) NOT NULL,
  `reported_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telemetry_snapshot`
--

LOCK TABLES `telemetry_snapshot` WRITE;
/*!40000 ALTER TABLE `telemetry_snapshot` DISABLE KEYS */;
/*!40000 ALTER TABLE `telemetry_snapshot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'central_db'
--

--
-- Dumping routines for database 'central_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-28 23:01:01
